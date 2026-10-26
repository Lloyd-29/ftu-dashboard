<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PrepareDemoPresentation extends Command
{
    protected $signature = 'demo:prepare-presentation {--apply : Update demo dates after explicit backup}';

    protected $description = 'Preview or refresh only the dummy project dates for the 2 November 2026 presentation';

    private const DATES = [
        'PRJ-2417' => '2026-11-03',
        'INS-2409' => '2026-11-02',
        'ENG-2412' => '2026-10-30',
        'PRJ-2502' => '2026-11-05',
        'INS-2508' => '2026-11-04',
        'ENG-2510' => '2026-11-06',
        'PRJ-2603' => '2026-11-09',
        'INS-2607' => '2026-11-02',
    ];

    public function handle(): int
    {
        if (! app()->environment('local')) {
            $this->error('Demo preparation is restricted to APP_ENV=local.');
            return self::FAILURE;
        }

        $projects = Project::query()->whereIn('code', array_keys(self::DATES))->get()->keyBy('code');
        foreach (self::DATES as $code => $date) {
            $project = $projects->get($code);
            if (! $project || ! str_ends_with($project->client, ' Demo')) {
                $this->error('Missing or non-demo project: '.$code.'. No data changed.');
                return self::FAILURE;
            }
            $this->line($code.': '.($project->next_milestone_date?->toDateString() ?? 'empty').' -> '.$date);
        }

        if (! $this->option('apply')) {
            $this->info('Preview only. No changes made. Run with --apply only after a backup near 2 November.');
            return self::SUCCESS;
        }

        // Avoid future-dated last-updated timestamps when refreshing too early.
        $today = now('Asia/Jakarta')->toDateString();
        if ($today < '2026-10-30' || $today > '2026-11-02') {
            $this->error('Apply is restricted to 30 October–2 November 2026.');
            return self::FAILURE;
        }

        $actor = User::query()->where('username', 'engineering')->where('is_active', true)->first();
        if (! $actor) {
            $this->error('Active demo coordinator is required.');
            return self::FAILURE;
        }

        DB::transaction(function () use ($actor): void {
            foreach (self::DATES as $code => $date) {
                $project = Project::query()->where('code', $code)->lockForUpdate()->firstOrFail();
                if (! str_ends_with($project->client, ' Demo')) {
                    throw new \RuntimeException('Unexpected non-demo project.');
                }
                $original = $project->next_milestone_date?->toDateString();
                if ($original === $date) {
                    continue;
                }
                $project->next_milestone_date = $date;
                $project->version++;
                $project->updated_by = $actor->id;
                $project->save();
                // Preserve the existing milestone row, when it matches the next milestone.
                Milestone::query()->where('project_id', $project->id)
                    ->where('name', $project->next_milestone_name)->update(['due_date' => $date]);
                ActivityLog::query()->create([
                    'user_id' => $actor->id, 'project_id' => $project->id,
                    'field' => 'demo_milestone_date', 'old_value' => $original,
                    'new_value' => $date,
                ]);
            }
        }, 3);
        $this->info('Demo milestone dates updated; no accounts, tasks or documents reset.');
        return self::SUCCESS;
    }
}
