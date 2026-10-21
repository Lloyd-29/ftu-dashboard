<?php

namespace Database\Seeders;

use App\Models\Milestone;
use App\Models\Project;
use Illuminate\Database\Seeder;
use RuntimeException;

class MilestoneSeeder extends Seeder
{
    public function run(): void
    {
        $milestones = [
            'PRJ-2417' => [
                ['Kickoff desain separator', '2026-08-31', true],
                ['Finalisasi desain separator', '2026-10-23', false],
                ['Review akhir paket desain', '2026-11-06', false],
            ],
            'INS-2409' => [
                ['Kickoff inspeksi tank farm', '2026-09-02', true],
                ['Verifikasi data inspeksi', '2026-10-21', false],
                ['Laporan awal RBI', '2026-11-04', false],
            ],
            'ENG-2412' => [
                ['Penerimaan data piping', '2026-09-01', true],
                ['Revisi analisis tegangan', '2026-10-17', false],
                ['Pengiriman hasil review', '2026-10-29', false],
            ],
            'PRJ-2502' => [
                ['Kickoff compressor upgrade', '2026-09-07', true],
                ['Persetujuan gambar desain', '2026-10-30', false],
                ['Finalisasi engineering package', '2026-11-12', false],
            ],
            'INS-2508' => [
                ['Mobilisasi tim inspeksi', '2026-09-14', true],
                ['Pemeriksaan temuan lapangan', '2026-10-27', false],
                ['Laporan inspeksi struktur', '2026-11-09', false],
            ],
            'ENG-2510' => [
                ['Penyusunan data pipeline', '2026-09-08', true],
                ['Review hasil assessment', '2026-11-02', false],
                ['Pengiriman final assessment', '2026-11-16', false],
            ],
            'PRJ-2603' => [
                ['Kickoff P&ID engineering', '2026-10-01', true],
                ['Review P&ID', '2026-11-06', false],
                ['Persetujuan P&ID', '2026-11-20', false],
            ],
            'INS-2607' => [
                ['Persiapan rencana inspeksi', '2026-10-05', true],
                ['Penerimaan laporan NDT', '2026-10-24', false],
                ['Review hasil NDT', '2026-11-05', false],
            ],
        ];

        foreach ($milestones as $projectCode => $items) {
            $project = Project::query()
                ->where('code', $projectCode)
                ->first();

            if ($project === null) {
                throw new RuntimeException(
                    "Project not found: {$projectCode}"
                );
            }

            foreach ($items as [$name, $dueDate, $completed]) {
                Milestone::query()->firstOrCreate(
                    [
                        'project_id' => $project->id,
                        'name' => $name,
                    ],
                    [
                        'due_date' => $dueDate,
                        'is_completed' => $completed,
                    ]
                );
            }
        }
    }
}