<?php

namespace Database\Seeders;

use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class ActivityLogSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('Demo activity logs may only be seeded locally.');
        }

        // M1 uses username login; older demo accounts may still have the legacy email.
        $user = User::query()
            ->where('username', 'engineering')
            ->orWhere('email', 'engineering@ftu-demo.test')
            ->first();

        if ($user === null) {
            throw new RuntimeException('Demo engineering user not found.');
        }

        $events = [
            ['project_code' => 'PRJ-2417', 'field' => 'progress_percent', 'old_value' => '67', 'new_value' => '74', 'created_at' => '2026-10-19 09:10:00'],
            ['project_code' => 'INS-2409', 'field' => 'progress_percent', 'old_value' => '49', 'new_value' => '58', 'created_at' => '2026-10-19 09:15:00'],
            ['project_code' => 'ENG-2412', 'field' => 'status', 'old_value' => 'at_risk', 'new_value' => 'delayed', 'created_at' => '2026-10-17 11:00:00'],
            ['project_code' => 'PRJ-2502', 'field' => 'progress_percent', 'old_value' => '72', 'new_value' => '81', 'created_at' => '2026-10-19 09:25:00'],
            ['project_code' => 'INS-2508', 'field' => 'progress_percent', 'old_value' => '34', 'new_value' => '39', 'created_at' => '2026-10-19 09:30:00'],
            ['project_code' => 'ENG-2510', 'field' => 'progress_percent', 'old_value' => '58', 'new_value' => '66', 'created_at' => '2026-10-19 09:35:00'],
            ['project_code' => 'PRJ-2603', 'field' => 'progress_percent', 'old_value' => '19', 'new_value' => '22', 'created_at' => '2026-10-19 09:40:00'],
            ['project_code' => 'INS-2607', 'field' => 'status', 'old_value' => 'on_track', 'new_value' => 'at_risk', 'created_at' => '2026-10-16 14:00:00'],
        ];

        foreach ($events as $event) {
            $project = Project::query()->where('code', $event['project_code'])->first();

            if ($project === null) {
                throw new RuntimeException("Project not found: {$event['project_code']}");
            }

            $exists = ActivityLog::query()
                ->where('user_id', $user->id)
                ->where('project_id', $project->id)
                ->where('field', $event['field'])
                ->where('created_at', $event['created_at'])
                ->exists();

            if ($exists) {
                continue;
            }

            $log = new ActivityLog;
            $log->user()->associate($user);
            $log->project()->associate($project);
            $log->field = $event['field'];
            $log->old_value = $event['old_value'];
            $log->new_value = $event['new_value'];
            $log->created_at = $event['created_at'];
            $log->save();
        }
    }
}
