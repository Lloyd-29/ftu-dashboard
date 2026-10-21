<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Alert;
use App\Models\Engineer;
use App\Models\Project;
use App\Models\ProjectNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ProjectController extends Controller
{
    private const FIELDS = [
        'status','progress_percent','planned_progress_percent','sop_phase',
        'next_milestone_name','next_milestone_date','risks',
        'findings_open','findings_closed',
    ];

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Project::class);
        $projects = Project::query()->when($request->user()->role === 'engineer',
            fn ($q) => $q->whereHas('engineers', fn ($e) => $e->where('engineers.id', $request->user()->engineer_id ?? 0)))
            ->orderBy('code')->get();
        return response()->json(['projects' => $projects->map(fn ($p) => $this->display($p))->values()]);
    }

    public function show(Project $project): JsonResponse
    {
        Gate::authorize('view', $project);
        return response()->json(['project' => $this->display($project)]);
    }

    public function engineers(Request $request): JsonResponse
    {
        abort_unless($request->user()->canManageProjects(), 403);
        return response()->json(['engineers' => Engineer::query()->where('is_active', true)
            ->orderBy('name')->get(['id','name','initials'])]);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('update', $project);
        $data = $request->validate([
            'version' => ['required','integer','min:1'],
            'status' => ['sometimes','required','in:on_track,at_risk,delayed'],
            'progress_percent' => ['sometimes','nullable','integer','between:0,100'],
            'planned_progress_percent' => ['sometimes','nullable','integer','between:0,100'],
            'sop_phase' => ['sometimes','nullable','string','max:255'],
            'next_milestone_name' => ['sometimes','nullable','string','max:255'],
            'next_milestone_date' => ['sometimes','nullable','date_format:Y-m-d'],
            'risks' => ['sometimes','nullable','string','max:15000'],
            'findings_open' => ['sometimes','integer','min:0','max:1000000'],
            'findings_closed' => ['sometimes','integer','min:0','max:1000000'],
            'engineers' => ['sometimes','array'],
            'engineers.*.engineer_id' => ['required','integer','distinct','exists:engineers,id'],
            'engineers.*.allocation_percent' => ['required','integer','between:0,100'],
            'note' => ['sometimes','nullable','array'],
            'note.note_date' => ['required_with:note','date_format:Y-m-d'],
            'note.body' => ['required_with:note','string','max:10000'],
            'alerts' => ['sometimes','array'],
            'alerts.*.id' => ['sometimes','integer'],
            'alerts.*.title' => ['required','string','max:255'],
            'alerts.*.severity' => ['required','in:info,warning,critical'],
            'alerts.*.due_date' => ['nullable','date_format:Y-m-d'],
            'alerts.*.is_resolved' => ['required','boolean'],
        ]);

        $updated = DB::transaction(function () use ($request, $project, $data): Project {
            $locked = Project::query()->lockForUpdate()->findOrFail($project->id);
            if ($locked->version !== (int) $data['version']) {
                throw ValidationException::withMessages(['version' => 'Data sudah diubah pengguna lain. Muat ulang sebelum menyimpan.']);
            }
            $actorId = $request->user()->id;
            foreach (self::FIELDS as $field) {
                if (! array_key_exists($field, $data)) continue;
                $old = $locked->getRawOriginal($field);
                $new = $data[$field];
                if ($field === 'next_milestone_date' && $old !== null) $old = substr((string) $old, 0, 10);
                if ((string) ($old ?? '') !== (string) ($new ?? '')) {
                    $this->log($actorId, $locked->id, $field, $old, $new);
                }
                $locked->{$field} = $new;
            }
            if (array_key_exists('engineers', $data)) {
                $old = $locked->engineers()->orderBy('engineers.id')->get()
                    ->map(fn ($e) => [$e->id,(int) $e->pivot->allocation_percent])->all();
                $new = collect($data['engineers'])->map(fn ($e) => [(int) $e['engineer_id'],(int) $e['allocation_percent']])
                    ->sortBy(fn ($v) => $v[0])->values()->all();
                if ($old !== $new) {
                    $locked->engineers()->sync(collect($new)->mapWithKeys(fn ($e) => [$e[0] => ['allocation_percent'=>$e[1]]])->all());
                    $this->log($actorId,$locked->id,'engineers',$old,$new);
                }
            }
            if (isset($data['note'])) {
                $locked->notes()->create([
                    'note_date' => $data['note']['note_date'],
                    'body' => $data['note']['body'],
                    'created_by' => $actorId,
                ]);
                $this->log($actorId,$locked->id,'client_note',null,$data['note']);
            }
            if (array_key_exists('alerts', $data)) {
                $previous = $locked->alerts()->orderBy('id')->get()
                    ->map(fn ($a) => [$a->id,$a->title,$a->severity,$a->due_date?->toDateString(),$a->is_resolved])->all();
                $ids = [];
                foreach ($data['alerts'] as $alert) {
                    if (isset($alert['id'])) {
                        $found = $locked->alerts()->whereKey($alert['id'])->first();
                        if (! $found || in_array($found->id,$ids,true)) {
                            throw ValidationException::withMessages(['alerts' => 'Daftar peringatan tidak valid. Muat ulang halaman.']);
                        }
                    } else {
                        $found = new Alert();
                        $found->project_id = $locked->id;
                    }
                    $found->title = $alert['title'];
                    $found->severity = $alert['severity'];
                    $found->due_date = $alert['due_date'] ?? null;
                    $found->is_resolved = $alert['is_resolved'];
                    $found->save();
                    $ids[] = $found->id;
                }
                $locked->alerts()->whereNotIn('id',$ids)->delete();
                $next = $locked->alerts()->orderBy('id')->get()
                    ->map(fn ($a) => [$a->id,$a->title,$a->severity,$a->due_date?->toDateString(),$a->is_resolved])->all();
                if ($previous !== $next) $this->log($actorId,$locked->id,'alerts',$previous,$next);
            }
            $locked->version++;
            $locked->updated_by = $actorId;
            $locked->save();
            $this->log($actorId,$locked->id,'version',$data['version'],$locked->version);
            return $locked;
        }, 3);
        return response()->json(['project'=>$this->display($updated)]);
    }

    private function display(Project $project): array
    {
        $project->load(['engineers:id,name,initials','notes' => fn ($q) => $q->orderByDesc('note_date')->orderByDesc('id'),
            'notes.createdBy:id,name','alerts' => fn ($q) => $q->orderByDesc('id')]);
        return [
            'id'=>$project->id, 'code'=>$project->code, 'name'=>$project->name, 'client'=>$project->client,
            'status'=>$project->status,'progress_percent'=>$project->progress_percent,
            'planned_progress_percent'=>$project->planned_progress_percent,'sop_phase'=>$project->sop_phase,
            'next_milestone_name'=>$project->next_milestone_name,
            'next_milestone_date'=>$project->next_milestone_date?->toDateString(),
            'risks'=>$project->risks,'findings_open'=>$project->findings_open,
            'findings_closed'=>$project->findings_closed,'version'=>$project->version,
            'updated_at'=>$project->updated_at?->toIso8601String(),
            'engineers'=>$project->engineers->map(fn ($e) => [
                'engineer_id'=>$e->id,'name'=>$e->name,'allocation_percent'=>$e->pivot->allocation_percent,
            ])->values(),
            'notes'=>$project->notes->map(fn ($n) => [
                'id'=>$n->id,'note_date'=>$n->note_date->toDateString(),'body'=>$n->body,
                'created_by_name'=>$n->createdBy?->name,
            ])->values(),
            'alerts'=>$project->alerts->map(fn ($a) => [
                'id'=>$a->id,'title'=>$a->title,'severity'=>$a->severity,
                'due_date'=>$a->due_date?->toDateString(),'is_resolved'=>$a->is_resolved,
            ])->values(),
        ];
    }

    private function log(int $userId, int $projectId, string $field, mixed $old, mixed $new): void
    {
        ActivityLog::create([
            'user_id'=>$userId,'project_id'=>$projectId,'field'=>$field,
            'old_value'=>$old === null ? null : json_encode($old,JSON_UNESCAPED_UNICODE),
            'new_value'=>$new === null ? null : json_encode($new,JSON_UNESCAPED_UNICODE),
        ]);
    }
}
