<?php

namespace Database\Seeders;

use App\Models\Engineer;
use App\Models\Project;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProjectEngineerSeeder extends Seeder
{
    public function run(): void
    {
        $assignments = [
            'PRJ-2417' => [
                'Andi Pratama' => 40,
                'Citra Maharani' => 35,
                'Fajar Ramadhan' => 30,
            ],
            'INS-2409' => [
                'Budi Santoso' => 50,
                'Gita Permata' => 40,
                'Joko Firmansyah' => 20,
            ],
            'ENG-2412' => [
                'Dimas Saputra' => 55,
                'Eka Putri' => 30,
                'Hendra Wijaya' => 25,
            ],
            'PRJ-2502' => [
                'Andi Pratama' => 35,
                'Intan Lestari' => 40,
                'Joko Firmansyah' => 20,
            ],
            'INS-2508' => [
                'Budi Santoso' => 40,
                'Citra Maharani' => 30,
                'Gita Permata' => 20,
            ],
            'ENG-2510' => [
                'Dimas Saputra' => 35,
                'Fajar Ramadhan' => 45,
                'Hendra Wijaya' => 30,
            ],
            'PRJ-2603' => [
                'Eka Putri' => 50,
                'Intan Lestari' => 40,
                'Joko Firmansyah' => 30,
            ],
            'INS-2607' => [
                'Gita Permata' => 25,
                'Hendra Wijaya' => 30,
                'Fajar Ramadhan' => 40,
            ],
        ];

        foreach ($assignments as $projectCode => $members) {
            $project = Project::query()
                ->where('code', $projectCode)
                ->first();

            if ($project === null) {
                throw new RuntimeException(
                    "Project not found: {$projectCode}"
                );
            }

            foreach ($members as $engineerName => $percent) {
                $engineer = Engineer::query()
                    ->where('name', $engineerName)
                    ->first();

                if ($engineer === null) {
                    throw new RuntimeException(
                        "Engineer not found: {$engineerName}"
                    );
                }

                $exists = DB::table('project_engineer')
                    ->where('project_id', $project->id)
                    ->where('engineer_id', $engineer->id)
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('project_engineer')->insert([
                    'project_id' => $project->id,
                    'engineer_id' => $engineer->id,
                    'allocation_percent' => $percent,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}