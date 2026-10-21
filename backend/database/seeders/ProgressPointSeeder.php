<?php

namespace Database\Seeders;

use App\Models\ProgressPoint;
use App\Models\Project;
use Illuminate\Database\Seeder;
use RuntimeException;

class ProgressPointSeeder extends Seeder
{
    public function run(): void
    {
        $weeks = [
            '2026-08-31',
            '2026-09-07',
            '2026-09-14',
            '2026-09-21',
            '2026-09-28',
            '2026-10-05',
            '2026-10-12',
            '2026-10-19',
        ];

        $progress = [
            'PRJ-2417' => [
                'planned' => [9, 18, 27, 36, 45, 54, 63, 72],
                'actual' => [8, 18, 29, 39, 48, 58, 67, 74],
            ],
            'INS-2409' => [
                'planned' => [9, 18, 27, 36, 45, 54, 63, 72],
                'actual' => [5, 12, 20, 27, 33, 40, 49, 58],
            ],
            'ENG-2412' => [
                'planned' => [8, 16, 24, 32, 40, 48, 56, 65],
                'actual' => [4, 9, 15, 21, 28, 35, 40, 45],
            ],
            'PRJ-2502' => [
                'planned' => [12, 22, 32, 42, 53, 62, 71, 80],
                'actual' => [9, 19, 30, 41, 53, 63, 72, 81],
            ],
            'INS-2508' => [
                'planned' => [6, 13, 20, 27, 34, 41, 48, 55],
                'actual' => [3, 7, 12, 18, 23, 29, 34, 39],
            ],
            'ENG-2510' => [
                'planned' => [7, 15, 22, 30, 38, 45, 53, 60],
                'actual' => [8, 17, 25, 34, 43, 50, 58, 66],
            ],
            'PRJ-2603' => [
                'planned' => [2, 4, 7, 10, 12, 15, 18, 20],
                'actual' => [1, 4, 8, 10, 13, 16, 19, 22],
            ],
            'INS-2607' => [
                'planned' => [4, 9, 13, 18, 22, 27, 31, 35],
                'actual' => [
                    null, null, null, null,
                    null, null, null, null,
                ],
            ],
        ];

        foreach ($progress as $projectCode => $series) {
            $project = Project::query()
                ->where('code', $projectCode)
                ->first();

            if ($project === null) {
                throw new RuntimeException(
                    "Project not found: {$projectCode}"
                );
            }

            if (
                count($series['planned']) !== count($weeks) ||
                count($series['actual']) !== count($weeks)
            ) {
                throw new RuntimeException(
                    "Invalid progress series: {$projectCode}"
                );
            }

            foreach ($weeks as $index => $weekDate) {
                ProgressPoint::query()->firstOrCreate(
                    [
                        'project_id' => $project->id,
                        'week_date' => $weekDate,
                    ],
                    [
                        'planned' => $series['planned'][$index],
                        'actual' => $series['actual'][$index],
                    ]
                );
            }
        }
    }
}