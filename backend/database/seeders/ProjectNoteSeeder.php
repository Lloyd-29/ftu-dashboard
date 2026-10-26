<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\ProjectNote;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class ProjectNoteSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('Demo notes may only be seeded locally.');
        }

        // M1 uses username login; older demo accounts may still have the legacy email.
        $author = User::query()
            ->where('username', 'engineering')
            ->orWhere('email', 'engineering@ftu-demo.test')
            ->first();

        if ($author === null) {
            throw new RuntimeException('Demo engineering user not found.');
        }

        $notes = [
            'PRJ-2417' => [
                'Tim demo meninjau kebutuhan layout separator.',
                'Klien demo meminta pengecekan nozzle sebelum finalisasi desain.',
            ],
            'INS-2409' => [
                'Data inspeksi tank farm diterima sebagian.',
                'Klien demo diminta melengkapi riwayat inspeksi.',
            ],
            'ENG-2412' => [
                'Tim demo menerima revisi data beban piping.',
                'Klien demo meminta evaluasi tambahan pada area kritis.',
            ],
            'PRJ-2502' => [
                'Konsep upgrade compressor dibahas bersama klien demo.',
                'Komentar awal gambar desain telah dikonsolidasikan.',
            ],
            'INS-2508' => [
                'Rencana mobilisasi inspeksi disampaikan kepada klien demo.',
                'Jadwal lapangan perlu disesuaikan dengan kondisi cuaca.',
            ],
            'ENG-2510' => [
                'Ruang lingkup pipeline assessment telah dibahas.',
                'Tim demo menyiapkan klarifikasi temuan integritas.',
            ],
            'PRJ-2603' => [
                'Kebutuhan awal metering skid telah dikumpulkan.',
                'Klien demo memberikan komentar pada draft P&ID.',
            ],
            'INS-2607' => [
                'Rencana inspeksi pressure vessel telah disampaikan.',
                'Laporan NDT masih menunggu pengiriman dari tim lapangan.',
            ],
        ];

        $dates = ['2026-10-09', '2026-10-16'];

        foreach ($notes as $projectCode => $projectNotes) {
            $project = Project::query()
                ->where('code', $projectCode)
                ->first();

            if ($project === null) {
                throw new RuntimeException("Project not found: {$projectCode}");
            }

            foreach ($projectNotes as $index => $body) {
                $note = ProjectNote::query()->firstOrNew([
                    'project_id' => $project->id,
                    'note_date' => $dates[$index],
                    'body' => $body,
                ]);

                if ($note->exists) {
                    continue;
                }

                $note->created_by = $author->id;
                $note->save();
            }
        }
    }
}
