<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use App\Models\FieldVerification;
use App\Models\Project;
use App\Models\Task;
use App\Support\TeamActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class FieldVerificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', FieldVerification::class);
        $data = $request->validate([
            'project_id' => ['sometimes', 'integer', 'exists:projects,id'],
            'review_status' => ['sometimes', 'in:pending,submitted,revision_needed,verified'],
        ]);
        $query = FieldVerification::query()->with(['task.project:id,code,name', 'task.assignee:id,name', 'verifier:id,name']);
        if ($request->user()->role === 'engineer') {
            $query->whereHas('task', fn ($q) => $q->where('assignee_engineer_id', $request->user()->engineer_id ?? 0)
                ->whereHas('project.engineers', fn ($e) => $e->where('engineers.id', $request->user()->engineer_id ?? 0)));
        }
        if (isset($data['project_id'])) $query->whereHas('task', fn ($q) => $q->where('project_id', $data['project_id']));
        if (isset($data['review_status'])) $query->where('review_status', $data['review_status']);
        return response()->json(['verifications' => $query->orderBy('visit_date')->orderByDesc('id')
            ->get()->map(fn (FieldVerification $verification) => $this->present($verification))->values()]);
    }

    public function show(FieldVerification $verification): JsonResponse
    {
        Gate::authorize('view', $verification);
        return response()->json(['verification' => $this->present($verification->load(['task.project:id,code,name', 'task.assignee:id,name', 'verifier:id,name']))]);
    }

    public function candidates(Request $request): JsonResponse
    {
        Gate::authorize('create', Task::class);
        $data = $request->validate(['project_id' => ['required', 'integer', 'exists:projects,id']]);
        $project = Project::query()->findOrFail($data['project_id']);
        abort_unless($project->is_active, 422, 'Proyek tidak aktif.');
        $assigned = $project->engineers()->pluck('engineers.id')->all();
        $candidates = Engineer::query()->where('is_active', true)->with(['projects' =>
            fn ($query) => $query->where('projects.is_active', true)])->get()->map(function (Engineer $engineer) use ($assigned): array {
            $allocation = (int) $engineer->projects->sum(fn (Project $p) => (int) $p->pivot->allocation_percent);
            $isAssigned = in_array($engineer->id, $assigned, true);
            return [
                'engineer_id' => $engineer->id, 'name' => $engineer->name,
                'total_allocation_percent' => $allocation,
                'remaining_capacity_percent' => max(0, 100 - $allocation),
                'is_assigned_to_project' => $isAssigned,
                'is_available' => $isAssigned && $allocation < 80,
            ];
        })->sort(fn ($a, $b) => ($b['is_available'] <=> $a['is_available'])
            ?: ($b['remaining_capacity_percent'] <=> $a['remaining_capacity_percent'])
            ?: strcmp($a['name'], $b['name']))->values();
        return response()->json(['candidates' => $candidates]);
    }

    public function submit(Request $request, FieldVerification $verification): JsonResponse
    {
        Gate::authorize('submit', $verification);
        $data = $request->validate([
            'result' => ['required', 'in:confirmed,findings'],
            'findings_count' => ['required', 'integer', 'min:0', 'max:1000000'],
            'notes' => ['required', 'string', 'min:3', 'max:15000'],
        ]);
        if (($data['result'] === 'confirmed' && (int) $data['findings_count'] !== 0)
            || ($data['result'] === 'findings' && (int) $data['findings_count'] < 1)) {
            throw ValidationException::withMessages(['findings_count' => 'Hasil sesuai harus 0 temuan; hasil dengan temuan harus lebih dari 0.']);
        }
        $updated = DB::transaction(function () use ($verification, $data, $request): FieldVerification {
            $locked = FieldVerification::query()->lockForUpdate()->findOrFail($verification->id);
            if (! in_array($locked->review_status, ['pending', 'revision_needed'], true)) {
                throw ValidationException::withMessages(['result' => 'Laporan sudah diajukan atau diverifikasi.']);
            }
            $before = ['review_status' => $locked->review_status, 'result' => $locked->result];
            $locked->fill([
                'result' => $data['result'], 'findings_count' => $data['findings_count'],
                'notes' => $data['notes'], 'review_status' => 'submitted', 'review_note' => null,
                'submitted_at' => now(), 'verified_at' => null, 'verified_by' => null,
            ])->save();
            $task = Task::query()->whereKey($locked->task_id)->lockForUpdate()->firstOrFail();
            $task->status = 'doing';
            $task->save();
            TeamActivity::record($request->user()->id, $task->project_id, 'field_verification_submitted',
                ['verification_id' => $locked->id, ...$before],
                ['verification_id' => $locked->id, 'result' => $locked->result, 'findings_count' => $locked->findings_count]);
            return $locked;
        }, 3);
        return response()->json(['verification' => $this->present($updated->load(['task.project:id,code,name', 'task.assignee:id,name', 'verifier:id,name']))]);
    }

    public function review(Request $request, FieldVerification $verification): JsonResponse
    {
        Gate::authorize('review', $verification);
        $data = $request->validate([
            'decision' => ['required', 'in:verify,revision_needed'],
            'review_note' => ['required_if:decision,revision_needed', 'nullable', 'string', 'max:10000'],
        ]);
        $updated = DB::transaction(function () use ($verification, $data, $request): FieldVerification {
            $locked = FieldVerification::query()->lockForUpdate()->findOrFail($verification->id);
            if ($locked->review_status !== 'submitted') {
                throw ValidationException::withMessages(['decision' => 'Hanya laporan berstatus menunggu review yang bisa diproses.']);
            }
            $task = Task::query()->whereKey($locked->task_id)->lockForUpdate()->firstOrFail();
            if ($data['decision'] === 'verify') {
                $locked->review_status = 'verified';
                $locked->review_note = $data['review_note'] ?? null;
                $locked->verified_by = $request->user()->id;
                $locked->verified_at = now();
                $task->status = 'done';
                // Idempotent accounting: applied_findings_count makes duplicate approvals harmless.
                $delta = $locked->findings_count - $locked->applied_findings_count;
                if ($delta > 0) {
                    $project = Project::query()->whereKey($task->project_id)->lockForUpdate()->firstOrFail();
                    $before = $project->findings_open;
                    $project->findings_open += $delta;
                    $project->version += 1;
                    $project->updated_by = $request->user()->id;
                    $project->save();
                    $locked->applied_findings_count += $delta;
                    TeamActivity::record($request->user()->id, $project->id, 'findings_open', $before, $project->findings_open);
                }
            } else {
                $locked->review_status = 'revision_needed';
                $locked->review_note = $data['review_note'];
                $locked->verified_by = null;
                $locked->verified_at = null;
                $task->status = 'doing';
            }
            $task->save();
            $locked->save();
            TeamActivity::record($request->user()->id, $task->project_id, 'field_verification_review',
                ['verification_id' => $locked->id, 'review_status' => 'submitted'],
                ['verification_id' => $locked->id, 'review_status' => $locked->review_status, 'review_note' => $locked->review_note]);
            return $locked;
        }, 3);
        return response()->json(['verification' => $this->present($updated->load(['task.project:id,code,name', 'task.assignee:id,name', 'verifier:id,name']))]);
    }

    private function present(FieldVerification $verification): array
    {
        $task = $verification->task;
        return [
            'id' => $verification->id, 'task_id' => $task->id,
            'task_title' => $task->title, 'task_status' => $task->status,
            'project_id' => $task->project_id, 'project_code' => $task->project?->code,
            'project_name' => $task->project?->name,
            'assignee_engineer_id' => $task->assignee_engineer_id,
            'assignee_name' => $task->assignee?->name,
            'site_name' => $verification->site_name, 'visit_date' => $verification->visit_date->toDateString(),
            'result' => $verification->result, 'findings_count' => $verification->findings_count,
            'notes' => $verification->notes, 'review_status' => $verification->review_status,
            'review_note' => $verification->review_note, 'submitted_at' => $verification->submitted_at?->toIso8601String(),
            'verified_by_name' => $verification->verifier?->name,
            'verified_at' => $verification->verified_at?->toIso8601String(),
        ];
    }
}
