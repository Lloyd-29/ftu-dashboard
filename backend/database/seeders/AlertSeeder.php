<?php

namespace Database\Seeders;

use App\Models\Alert;
use App\Models\Project;
use Illuminate\Database\Seeder;
use RuntimeException;

class AlertSeeder extends Seeder
{
    public function run(): void
    {
        $alerts = [
            [
                'project_code' => 'INS-2409',
                'title' => 'Data inspeksi belum lengkap',
                'severity' => 'warning',
                'due_date' => '2026-10-21',
                'is_resolved' => false,
            ],
            [
                'project_code' => 'ENG-2412',
                'title' => 'Revisi data beban piping terlambat',
                'severity' => 'critical',
                'due_date' => '2026-10-17',
                'is_resolved' => false,
            ],
            [
                'project_code' => 'INS-2508',
                'title' => 'Jadwal inspeksi terdampak cuaca',
                'severity' => 'critical',
                'due_date' => '2026-10-27',
                'is_resolved' => false,
            ],
            [
                'project_code' => 'INS-2607',
                'title' => 'Progres aktual belum dilaporkan',
                'severity' => 'warning',
                'due_date' => '2026-10-24',
                'is_resolved' => false,
            ],
            [
                'project_code' => 'PRJ-2417',
                'title' => 'Konfirmasi nozzle separator diperlukan',
                'severity' => 'info',
                'due_date' => '2026-10-23',
                'is_resolved' => false,
            ],
            [
                'project_code' => 'ENG-2510',
                'title' => 'Data integritas pipa perlu diklarifikasi',
                'severity' => 'warning',
                'due_date' => '2026-11-02',
                'is_resolved' => false,
            ],
            [
                'project_code' => 'PRJ-2502',
                'title' => 'Komentar awal gambar telah ditinjau',
                'severity' => 'info',
                'due_date' => '2026-10-12',
                'is_resolved' => true,
            ],
            [
                'project_code' => 'PRJ-2603',
                'title' => 'Dokumen referensi P&ID diterima',
                'severity' => 'info',
                'due_date' => '2026-10-07',
                'is_resolved' => true,
            ],
        ];

        foreach ($alerts as $data) {
            $project = Project::query()
                ->where('code', $data['project_code'])
                ->first();

            if ($project === null) {
                throw new RuntimeException(
                    "Project not found: {$data['project_code']}"
                );
            }

            Alert::query()->firstOrCreate(
                [
                    'project_id' => $project->id,
                    'title' => $data['title'],
                ],
                [
                    'severity' => $data['severity'],
                    'due_date' => $data['due_date'],
                    'is_resolved' => $data['is_resolved'],
                ]
            );
        }
    }
}