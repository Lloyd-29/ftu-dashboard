<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Engineer;
use App\Models\Milestone;
use App\Models\ProgressPoint;
use App\Models\Project;
use App\Models\ProjectNote;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

final class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        // Protected by auth:sanctum and view-dashboard authorization in routes/api.php.
        $now = now();
        $today = $now->copy()->startOfDay();
        $endDate = $today->copy()->addDays(14);

        $rotationSeconds = max(5, (int) (Setting::query()
            ->where('key', 'slide_rotation_seconds')->value('value') ?? 25));
        $staleDays = max(1, (int) (Setting::query()
            ->where('key', 'stale_after_days')->value('value') ?? 7));

        $projects = Project::query()
            ->where('is_active', true)
            ->with([
                'updatedBy:id,name',
                'progressPoints' => fn ($query) => $query->orderBy('week_date'),
            ])
            ->orderBy('code')
            ->get();
        $projectIds = $projects->pluck('id');

        $alerts = Alert::query()
            ->with('project:id,code,name')
            ->where('is_resolved', false)
            ->where(fn ($query) => $query
                ->whereNull('project_id')
                ->orWhereIn('project_id', $projectIds))
            ->orderByRaw("CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END")
            ->orderBy('due_date')
            ->get();

        $milestones = Milestone::query()
            ->with('project:id,code,name')
            ->whereIn('project_id', $projectIds)
            ->where('is_completed', false)
            ->whereDate('due_date', '<=', $endDate->toDateString())
            ->orderBy('due_date')
            ->get()
            ->map(fn (Milestone $milestone): array => [
                'id' => $milestone->id,
                'project_code' => $milestone->project?->code,
                'project_name' => $milestone->project?->name,
                'name' => $milestone->name,
                'due_date' => $milestone->due_date->toDateString(),
                'is_overdue' => $milestone->due_date->lt($today),
            ]);

        $notes = ProjectNote::query()
            ->with(['project:id,code,name', 'createdBy:id,name'])
            ->whereIn('project_id', $projectIds)
            ->orderByDesc('note_date')
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(fn (ProjectNote $note): array => [
                'id' => $note->id,
                'project_code' => $note->project?->code,
                'project_name' => $note->project?->name,
                'note_date' => $note->note_date->toDateString(),
                'body' => $note->body,
                'created_by_name' => $note->createdBy?->name,
            ]);

        $workload = Engineer::query()
            ->where('is_active', true)
            ->with(['projects' => fn ($query) => $query->where('projects.is_active', true)])
            ->orderBy('name')
            ->get()
            ->map(function (Engineer $engineer): array {
                $total = (int) $engineer->projects->sum(fn (Project $project): int => (int) $project->pivot->allocation_percent);
                return [
                    'name' => $engineer->name,
                    'total_allocation_percent' => $total,
                    'is_overallocated' => $total > 100,
                    'assignments' => $engineer->projects
                        ->map(fn (Project $project): array => [
                            'project_code' => $project->code,
                            'project_name' => $project->name,
                            'allocation_percent' => (int) $project->pivot->allocation_percent,
                        ])->values()->all(),
                ];
            });

        $latestChange = collect([
            Project::query()->max('updated_at'),
            ProjectNote::query()->max('updated_at'),
            Milestone::query()->max('updated_at'),
            ProgressPoint::query()->max('updated_at'),
            Alert::query()->max('updated_at'),
            Engineer::query()->max('updated_at'),
            Setting::query()->max('updated_at'),
        ])->filter()->max();

        return response()->json([
            'generated_at' => $now->toIso8601String(),
            'last_updated_at' => $latestChange ? Carbon::parse($latestChange)->toIso8601String() : null,
            'settings' => [
                'slide_rotation_seconds' => $rotationSeconds,
                'stale_after_days' => $staleDays,
            ],
            'summary' => [
                'total_projects' => $projects->count(),
                'on_track' => $projects->where('status', 'on_track')->count(),
                'at_risk' => $projects->where('status', 'at_risk')->count(),
                'delayed' => $projects->where('status', 'delayed')->count(),
                'without_progress' => $projects->whereNull('progress_percent')->count(),
                'findings_open' => $projects->sum('findings_open'),
                'findings_closed' => $projects->sum('findings_closed'),
                'active_alerts' => $alerts->count(),
            ],
            'projects' => $projects->map(fn (Project $project): array => [
                'code' => $project->code,
                'name' => $project->name,
                'client' => $project->client,
                'status' => $project->status,
                'progress_percent' => $project->progress_percent,
                'planned_progress_percent' => $project->planned_progress_percent,
                'sop_phase' => $project->sop_phase,
                'next_milestone_name' => $project->next_milestone_name,
                'next_milestone_date' => $project->next_milestone_date?->toDateString(),
                'risks' => $project->risks,
                'findings_open' => $project->findings_open,
                'findings_closed' => $project->findings_closed,
                'updated_at' => $project->updated_at?->toIso8601String(),
                'updated_by_name' => $project->updatedBy?->name,
                'is_stale' => $project->updated_at === null || $project->updated_at->lt($now->copy()->subDays($staleDays)),
            ])->values()->all(),
            'alerts' => $alerts->map(fn (Alert $alert): array => [
                'id' => $alert->id,
                'title' => $alert->title,
                'severity' => $alert->severity,
                'project_code' => $alert->project?->code,
                'due_date' => $alert->due_date?->toDateString(),
                'is_overdue' => $alert->due_date?->lt($today) ?? false,
            ])->values()->all(),
            'upcoming_milestones' => $milestones->filter(fn (array $item): bool => ! $item['is_overdue'])->values()->all(),
            'overdue_milestones' => $milestones->filter(fn (array $item): bool => $item['is_overdue'])->values()->all(),
            's_curve' => $projects->map(fn (Project $project): array => [
                'project_code' => $project->code,
                'project_name' => $project->name,
                'points' => $project->progressPoints->map(fn (ProgressPoint $point): array => [
                    'week_date' => $point->week_date->toDateString(),
                    'planned' => $point->planned,
                    'actual' => $point->actual,
                ])->values()->all(),
            ])->values()->all(),
            'engineer_workload' => $workload->values()->all(),
            'latest_client_notes' => $notes->values()->all(),
        ])->header('Cache-Control', 'no-store');
    }
}
