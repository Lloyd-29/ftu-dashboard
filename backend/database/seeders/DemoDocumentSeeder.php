<?php

namespace Database\Seeders;

use App\Models\Document;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class DemoDocumentSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('Dummy PDFs may only be seeded locally.');
        }
        $projects = Project::query()->orderBy('id')->limit(3)->get();
        $reviewer = User::query()->whereIn('role', ['coordinator', 'director', 'admin'])->orderBy('id')->first();
        if (! $reviewer || $projects->count() < 3) {
            $this->command?->warn('Seed memerlukan tiga proyek demo dan satu reviewer; dilewati.');

            return;
        }
        $examples = [
            ['FTU-9001/R.RLA-PRV/X/2026', 'Residual Life Assessment (Demo)', 'Residual Life Assessment', 'A', 'submitted', null],
            ['FTU-9002/R.RBI-PLT/X/2026', 'Risk Based Inspection (Demo)', 'RBI', 'A', 'revision_needed', 'Harap perjelas kesimpulan.'],
            ['FTU-9003/R.INS-PIPE/X/2026', 'Laporan Inspeksi Pipa (Demo)', 'Laporan Inspeksi', '0', 'checked', null],
        ];
        foreach ($projects as $index => $project) {
            [$number, $title, $type, $label, $status, $note] = $examples[$index];
            if (Document::query()->where('doc_no', $number)->exists()) {
                continue;
            }
            $engineerId = $project->engineers()->orderBy('engineers.id')->value('engineers.id');
            $uploader = $engineerId ? User::query()->where('role', 'engineer')->where('engineer_id', $engineerId)->first() : null;
            $document = Document::query()->create([
                'project_id' => $project->id, 'task_id' => null,
                'doc_no' => $number, 'title' => $title,
                'doc_type' => $type, 'client_name' => 'Klien Simulasi',
            ]);
            $path = 'documents/'.$document->id.'/dummy-'.$index.'.pdf';
            Storage::disk('local')->put($path, $this->dummyPdf('Laporan Dummy FTU '.($index + 1)));
            $document->revisions()->create([
                'revision_label' => $label, 'description' => 'Berkas contoh tanpa data klien nyata.',
                'issued_date' => '2026-10-28', 'stored_file_path' => $path,
                'original_file_name' => 'contoh-ftu-'.($index + 1).'.pdf',
                'mime_type' => 'application/pdf', 'file_size' => Storage::disk('local')->size($path),
                'uploaded_by' => ($uploader ?? $reviewer)->id, 'status' => $status,
                'reviewed_by' => $status !== 'submitted' ? $reviewer->id : null,
                'reviewed_at' => $status !== 'submitted' ? now() : null,
                'review_note' => $note,
            ]);
        }
    }

    private function dummyPdf(string $label): string
    {
        $safe = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $label);
        $stream = 'BT /F1 16 Tf 55 750 Td ('.$safe.') Tj ET';
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
            '<< /Length '.strlen($stream).' >>'."\nstream\n".$stream."\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf('%010d 00000 n ', $offset)."\n";
        }

        return $pdf."trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF\n";
    }
}
