<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use App\Models\Project;
use App\Models\Task;
use App\Support\TeamActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Task::class);
        $data = $request->validate([
            'project_id' => ['sometimes', 'integer', 'exists:projects,id'],
            'assignee_engineer_id' => ['sometimes', 'integer', 'exists:engineers,id'],
            'status' => ['sometimes', 'in:todo,doing,done'],
        ]);
        $query = Task::query()->with(['project:id,code,name', 'assignee:id,name', 'verification:id,task_id,review_status,visit_date']);
        if ($request->user()->role === 'engineer') {
            $query->where('assignee_engineer_id', $request->user()->engineer_id ?? 0)
                ->whereHas('project.engineers', fn ($q) => $q->where('engineers.id', $request->user()->engineer_id ?? 0));
        }
        foreach (['project_id', 'assignee_engineer_id', 'status'] as $filter) {
            if (isset($data[$filter])) $query->where($filter, $data[$filter]);
        }
        return response()->json(['tasks' => $query->orderBy('due_date')->orderByDesc('id')->get()
            ->map(fn (Task $task) => $this->present($task))->values()]);
    }

    public function show(Task $task): JsonResponse
    {
        Gate::authorize('view', $task);
        return response()->json(['task' => $this->present($task->load(['project:id,code,name', 'assignee:id,name', 'verification']))]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Task::class);
        $data = $request->validate([
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'assignee_engineer_id' => ['required', 'integer', 'exists:engineers,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'type' => ['required', 'in:job,field_verification'],
            'due_date' => ['required', 'date_format:Y-m-d'],
            'field_verification' => ['required_if:type,field_verification', 'prohibited_unless:type,field_verification', 'array'],
            'field_verification.site_name' => ['required_if:type,field_verification', 'string', 'max:255'],
            'field_verification.visit_date' => ['required_if:type,field_verification', 'date_format:Y-m-d'],
        ]);
        $task = DB::transaction(function () use ($request, $data): Task {
            $project = Project::query()->findOrFail($data['project_id']);
            $engineer = Engineer::query()->findOrFail($data['assignee_engineer_id']);
            if (! $project->is_active || ! $engineer->is_active ||
                ! $project->engineers()->whereKey($engineer->id)->exists()) {
                throw ValidationException::withMessages([
                    'assignee_engineer_id' => 'Engineer harus aktif dan ditugaskan ke proyek ini. Atur penugasan di menu Proyek.',
                ]);
            }
            if ($data['type'] === 'field_verification') {
                // Lock the engineer to serialize capacity checks and field assignments.
                Engineer::query()->whereKey($engineer->id)->lockForUpdate()->firstOrFail();
                $allocation = (int) DB::table('project_engineer')->join('projects', 'projects.id', '=', 'project_engineer.project_id')
                    ->where('project_engineer.engineer_id', $engineer->id)
                    ->where('projects.is_active', true)
                    ->sum('project_engineer.allocation_percent');
                if ($allocation >= 80) {
                    throw ValidationException::withMessages([
                        'assignee_engineer_id' => 'Engineer tidak tersedia: total alokasi harus di bawah 80%.',
                    ]);
                }
            }
            $task = Task::query()->create([
                'project_id' => $project->id,
                'assignee_engineer_id' => $engineer->id,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'type' => $data['type'],
                'due_date' => $data['due_date'],
                'status' => 'todo',
                'created_by' => $request->user()->id,
            ]);
            if ($task->type === 'field_verification') {
                $task->verification()->create([
                    'site_name' => $data['field_verification']['site_name'],
                    'visit_date' => $data['field_verification']['visit_date'],
                ]);
            }
            TeamActivity::record($request->user()->id, $project->id, 'task_created', null, [
                'task_id' => $task->id, 'type' => $task->type, 'assignee_engineer_id' => $engineer->id,
            ]);
            return $task;
        }, 3);
        return response()->json(['task' => $this->present($task->load(['project:id,code,name', 'assignee:id,name', 'verification']))], 201);
    }

    public function updateStatus(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('updateStatus', $task);
        $data = $request->validate(['status' => ['required', 'in:todo,doing,done']]);
        $updated = DB::transaction(function () use ($task, $data, $request): Task {
            $locked = Task::query()->lockForUpdate()->findOrFail($task->id);
            if ($locked->type === 'field_verification') {
                if ($locked->verification?->review_status === 'verified' || $data['status'] === 'done' ||
                    $locked->verification?->review_status === 'submitted') {
                    throw ValidationException::withMessages(['status' => 'Status verifikasi mengikuti proses review.']);
                }
            }
            if ($locked->status !== $data['status']) {
                TeamActivity::record($request->user()->id, $locked->project_id, 'task_status',
                    ['task_id' => $locked->id, 'status' => $locked->status],
                    ['task_id' => $locked->id, 'status' => $data['status']]);
                $locked->status = $data['status'];
                $locked->save();
            }
            return $locked;
        }, 3);
        return response()->json(['task' => $this->present($updated->load(['project:id,code,name', 'assignee:id,name', 'verification']))]);
    }

    private function present(Task $task): array
    {
        return [
            'id' => $task->id, 'project_id' => $task->project_id,
            'project_code' => $task->project?->code, 'project_name' => $task->project?->name,
            'assignee_engineer_id' => $task->assignee_engineer_id, 'assignee_name' => $task->assignee?->name,
            'title' => $task->title, 'description' => $task->description,
            'type' => $task->type, 'due_date' => $task->due_date->toDateString(),
            'status' => $task->status,
            'review_status' => $task->verification?->review_status,
            'verification_id' => $task->verification?->id,
            'created_at' => $task->created_at?->toIso8601String(),
        ];
    }
}
