<?php

namespace Database\Seeders;

use App\Models\Project;
use Illuminate\Database\Seeder;
use RuntimeException;

class ProjectSeeder extends Seeder
{
    public function run(): void
    {
        $projects = [
            [
                'code' => 'PRJ-2417',
                'name' => 'Revamp Separator Train A',
                'client' => 'PT Nusa Energi Demo',
                'status' => 'on_track',
                'progress_percent' => 74,
                'planned_progress_percent' => 72,
                'next_milestone_name' => 'Finalisasi desain separator',
                'next_milestone_date' => '2026-10-23',
                'risks' => null,
                'findings_open' => 2,
                'findings_closed' => 7,
            ],
            [
                'code' => 'INS-2409',
                'name' => 'RBI Tank Farm Balikpapan',
                'client' => 'PT Terminal Bahari Demo',
                'status' => 'at_risk',
                'progress_percent' => 58,
                'planned_progress_percent' => 72,
                'next_milestone_name' => 'Verifikasi data inspeksi',
                'next_milestone_date' => '2026-10-21',
                'risks' => 'Data inspeksi belum lengkap.',
                'findings_open' => 9,
                'findings_closed' => 12,
            ],
            [
                'code' => 'ENG-2412',
                'name' => 'Piping Stress Review FSO',
                'client' => 'PT Maritim Teknik Demo',
                'status' => 'delayed',
                'progress_percent' => 45,
                'planned_progress_percent' => 65,
                'next_milestone_name' => 'Revisi analisis tegangan',
                'next_milestone_date' => '2026-10-17',
                'risks' => 'Revisi data beban belum diterima.',
                'findings_open' => 4,
                'findings_closed' => 3,
            ],
            [
                'code' => 'PRJ-2502',
                'name' => 'Gas Compressor Upgrade',
                'client' => 'PT Gas Mandiri Demo',
                'status' => 'on_track',
                'progress_percent' => 81,
                'planned_progress_percent' => 80,
                'next_milestone_name' => 'Persetujuan gambar desain',
                'next_milestone_date' => '2026-10-30',
                'risks' => null,
                'findings_open' => 1,
                'findings_closed' => 14,
            ],
            [
                'code' => 'INS-2508',
                'name' => 'Offshore Structural Inspection',
                'client' => 'PT Pesisir Energi Demo',
                'status' => 'delayed',
                'progress_percent' => 39,
                'planned_progress_percent' => 55,
                'next_milestone_name' => 'Pemeriksaan temuan lapangan',
                'next_milestone_date' => '2026-10-27',
                'risks' => 'Cuaca membatasi waktu inspeksi.',
                'findings_open' => 11,
                'findings_closed' => 4,
            ],
            [
                'code' => 'ENG-2510',
                'name' => 'Pipeline Integrity Assessment',
                'client' => 'PT Lintas Pipa Demo',
                'status' => 'on_track',
                'progress_percent' => 66,
                'planned_progress_percent' => 60,
                'next_milestone_name' => 'Review hasil assessment',
                'next_milestone_date' => '2026-11-02',
                'risks' => null,
                'findings_open' => 3,
                'findings_closed' => 10,
            ],
            [
                'code' => 'PRJ-2603',
                'name' => 'Metering Skid Engineering',
                'client' => 'PT Sistem Fluida Demo',
                'status' => 'on_track',
                'progress_percent' => 22,
                'planned_progress_percent' => 20,
                'next_milestone_name' => 'Review P&ID',
                'next_milestone_date' => '2026-11-06',
                'risks' => null,
                'findings_open' => 0,
                'findings_closed' => 2,
            ],
            [
                'code' => 'INS-2607',
                'name' => 'Pressure Vessel Inspection',
                'client' => 'PT Inspeksi Industri Demo',
                'status' => 'at_risk',
                'progress_percent' => null,
                'planned_progress_percent' => 35,
                'next_milestone_name' => 'Penerimaan laporan NDT',
                'next_milestone_date' => '2026-10-24',
                'risks' => 'Laporan progres belum diterima.',
                'findings_open' => 6,
                'findings_closed' => 1,
            ],
        ];

        foreach ($projects as $data) {
            $project = Project::query()->firstOrCreate(
                ['code' => $data['code']],
                $data
            );

            if ($project->name !== $data['name']) {
                throw new RuntimeException(
                    "Project code collision: {$data['code']}"
                );
            }
        }
    }
}