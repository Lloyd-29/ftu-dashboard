<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Engineer;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->withHeader('Accept', 'application/json');
    }

    private function user(string $role, ?Engineer $engineer = null): User
    {
        return User::query()->create([
            'name' => 'Demo '.$role, 'username' => $role.'.'.bin2hex(random_bytes(4)),
            'role' => $role, 'engineer_id' => $engineer?->id,
            'is_active' => true, 'must_change_password' => false,
            'password' => 'ExamplePassword123!',
        ]);
    }

    private function project(string $code): Project
    {
        return Project::query()->create([
            'code' => $code, 'name' => 'Proyek Uji', 'client' => 'Klien Dummy',
            'status' => 'on_track', 'progress_percent' => 20,
        ]);
    }

    private function pdf(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('report.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
    }

    private function fields(Project $project, string $no = 'FTU-0001/R.RLA-PRV/X/2026'): array
    {
        return [
            'project_id' => $project->id, 'doc_no' => $no, 'title' => 'Dokumen Dummy',
            'doc_type' => 'Residual Life Assessment', 'client_name' => 'Klien Simulasi',
            'revision_label' => 'A', 'description' => 'Terbit untuk review',
            'issued_date' => '2026-10-28', 'file' => $this->pdf(),
        ];
    }

    public function test_guest_and_viewer_cannot_read_documents(): void
    {
        $this->getJson('/api/documents')->assertUnauthorized();
        $this->getJson('/api/documents/types')->assertUnauthorized();
        $this->actingAs($this->user('viewer'));
        $this->getJson('/api/documents')->assertForbidden();
        $this->post('/api/documents', [])->assertForbidden();
    }

    public function test_engineer_uploads_private_pdf_and_cannot_read_others(): void
    {
        $project = $this->project('PRJ-M3-1');
        $other = $this->project('PRJ-M3-2');
        $engineer = Engineer::query()->create(['name' => 'Engineer A', 'initials' => 'EA']);
        $project->engineers()->attach($engineer, ['allocation_percent' => 30]);
        $actor = $this->user('engineer', $engineer);
        $this->actingAs($actor);
        $response = $this->post('/api/documents', $this->fields($project))->assertCreated();
        $docId = $response->json('document.id');
        $revisionId = $response->json('document.revisions.0.id');
        $path = Document::findOrFail($docId)->revisions()->firstOrFail()->stored_file_path;
        Storage::disk('local')->assertExists($path);
        $this->assertStringStartsWith('documents/', $path);
        $this->get('/api/document-revisions/'.$revisionId.'/download')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->post('/api/documents', $this->fields($other, 'FTU-0002/R.RLA-PRV/X/2026'))->assertForbidden();
        $manager = $this->user('coordinator');
        $this->actingAs($manager);
        $secret = $this->post('/api/documents', $this->fields($other, 'FTU-0003/R.RLA-PRV/X/2026'))->assertCreated();
        $secretDoc = $secret->json('document.id');
        $secretRevision = $secret->json('document.revisions.0.id');
        $this->actingAs($actor);
        $this->getJson('/api/documents')->assertOk()->assertJsonCount(1, 'documents');
        $this->getJson('/api/documents/'.$secretDoc)->assertForbidden();
        $this->get('/api/document-revisions/'.$secretRevision.'/download')->assertForbidden();
        $this->patchJson('/api/document-revisions/'.$revisionId.'/review', ['decision'=>'checked'])->assertForbidden();
    }

    public function test_pdf_mime_and_magic_and_size_are_enforced(): void
    {
        $project = $this->project('PRJ-M3-3');
        $this->actingAs($this->user('coordinator'));
        $invalid = $this->fields($project);
        $invalid['file'] = UploadedFile::fake()->createWithContent('fake.pdf', 'This is not a PDF');
        $this->post('/api/documents', $invalid)->assertStatus(422);
        $this->assertDatabaseCount('documents', 0);
        $large = $this->fields($project);
        $large['file'] = UploadedFile::fake()->create('large.pdf', 15361, 'application/pdf');
        $this->post('/api/documents', $large)->assertStatus(422);
        $this->assertDatabaseCount('documents', 0);
    }

    public function test_review_revision_sequence_pending_badge_and_audit(): void
    {
        $project = $this->project('PRJ-M3-4');
        $manager = $this->user('coordinator');
        $this->actingAs($manager);
        $result = $this->post('/api/documents', $this->fields($project))->assertCreated();
        $docId = $result->json('document.id');
        $first = $result->json('document.revisions.0.id');
        $this->getJson('/api/documents')->assertJsonPath('pending_review_count', 1);
        $this->patchJson('/api/document-revisions/'.$first.'/review', ['decision'=>'revision_needed'])
            ->assertUnprocessable()->assertJsonValidationErrors('review_note');
        $this->patchJson('/api/document-revisions/'.$first.'/review', [
            'decision'=>'revision_needed', 'review_note'=>'Perjelas hasil.',
        ])->assertOk()->assertJsonPath('revision.status', 'revision_needed');
        $second = $this->post('/api/documents/'.$docId.'/revisions', [
            'revision_label'=>'B', 'description'=>'Perbaikan laporan',
            'issued_date'=>'2026-10-29', 'file'=>$this->pdf(),
        ])->assertCreated();
        $this->assertCount(2, $second->json('document.revisions'));
        $revB = $second->json('document.revisions.1.id');
        $this->post('/api/documents/'.$docId.'/revisions', [
            'revision_label'=>'B', 'description'=>'Duplikat', 'issued_date'=>'2026-10-29', 'file'=>$this->pdf(),
        ])->assertStatus(422);
        $this->patchJson('/api/document-revisions/'.$revB.'/review', ['decision'=>'checked'])->assertOk()
            ->assertJsonPath('revision.status', 'checked');
        $this->patchJson('/api/document-revisions/'.$revB.'/review', ['decision'=>'revision_needed', 'review_note'=>'Ulang'])
            ->assertUnprocessable();
        $this->getJson('/api/documents')->assertJsonPath('pending_review_count', 0);
        $this->assertDatabaseHas('activity_logs', ['project_id'=>$project->id, 'field'=>'document_review']);
    }

    public function test_director_reviews_but_only_coordinator_can_delete_checked_revision(): void
    {
        $project = $this->project('PRJ-M3-5');
        $director = $this->user('director');
        $coordinator = $this->user('coordinator');
        $this->actingAs($coordinator);
        $doc = $this->post('/api/documents', $this->fields($project))->assertCreated();
        $id = $doc->json('document.id');
        $first = $doc->json('document.revisions.0.id');
        $this->patchJson('/api/document-revisions/'.$first.'/review', ['decision'=>'checked'])->assertOk();
        $second = $this->post('/api/documents/'.$id.'/revisions', [
            'revision_label'=>'0', 'description'=>'Terbit untuk approval',
            'issued_date'=>'2026-10-30', 'file'=>$this->pdf(),
        ])->assertCreated();
        $secondId = $second->json('document.revisions.1.id');
        $this->actingAs($director);
        $this->patchJson('/api/document-revisions/'.$secondId.'/review', ['decision'=>'checked'])->assertOk();
        $this->deleteJson('/api/document-revisions/'.$first)->assertForbidden();
        $this->actingAs($coordinator);
        $this->deleteJson('/api/document-revisions/'.$first)->assertOk();
        $this->assertDatabaseMissing('document_revisions', ['id'=>$first]);
        $this->assertDatabaseHas('document_revisions', ['id'=>$secondId]);
    }

    public function test_dashboard_counts_include_review_scheduled_visit_and_overdue_tasks(): void
    {
        $project = $this->project('PRJ-M3-6');
        $manager = $this->user('coordinator');
        $engineer = Engineer::query()->create(['name' => 'Engineer B']);
        $project->engineers()->attach($engineer, ['allocation_percent' => 20]);
        $this->actingAs($manager);
        $this->post('/api/documents', $this->fields($project))->assertCreated();
        Task::query()->create([
            'project_id' => $project->id, 'assignee_engineer_id' => $engineer->id,
            'title' => 'Tugas terlambat dummy', 'type' => 'job', 'status' => 'todo',
            'due_date' => now()->subDays(2)->toDateString(), 'created_by' => $manager->id,
        ]);
        $task = Task::query()->create([
            'project_id' => $project->id, 'assignee_engineer_id' => $engineer->id,
            'title' => 'Verifikasi dummy', 'type' => 'field_verification', 'status' => 'todo',
            'due_date' => now()->addDays(2)->toDateString(), 'created_by' => $manager->id,
        ]);
        $task->verification()->create(['site_name' => 'Lokasi Dummy', 'visit_date' => now()->addDay()->toDateString()]);
        $this->actingAs($this->user('viewer'));
        $this->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('summary.documents_pending_review', 1)
            ->assertJsonPath('summary.scheduled_field_verifications', 1)
            ->assertJsonPath('summary.overdue_tasks', 1);
    }

    public function test_managers_can_edit_document_types_and_engineers_cannot(): void
    {
        $manager = $this->user('director');
        $this->actingAs($manager);
        $this->putJson('/api/documents/types', ['types'=>['RBI','Dokumen Vendor','Lainnya']])
            ->assertOk()->assertJsonPath('types.0','RBI');
        $this->putJson('/api/documents/types', ['types'=>['RBI','rbi']])->assertUnprocessable();
        $this->getJson('/api/documents/types')->assertJsonPath('types.1', 'Dokumen Vendor');
        $this->actingAs($this->user('engineer'));
        $this->putJson('/api/documents/types', ['types'=>['Lainnya']])->assertForbidden();
    }
}
