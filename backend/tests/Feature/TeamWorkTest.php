<?php

namespace Tests\Feature;

use App\Models\Engineer;
use App\Models\FieldVerification;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamWorkTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, ?Engineer $engineer = null, bool $mustChange = false): User
    {
        return User::query()->create([
            'name' => 'Demo '.ucfirst($role),
            'username' => $role.'.'.bin2hex(random_bytes(3)),
            'role' => $role, 'engineer_id' => $engineer?->id,
            'is_active' => true, 'must_change_password' => $mustChange,
            'password' => 'ExamplePassword123!',
        ]);
    }

    private function project(string $code = 'PRJ-M2-A'): Project
    {
        return Project::query()->create([
            'code' => $code, 'name' => 'Proyek Uji Tim', 'client' => 'Klien Dummy',
            'status' => 'on_track', 'progress_percent' => 20,
        ]);
    }

    private function assignment(Project $project, int $percent = 30): Engineer
    {
        $engineer = Engineer::query()->create(['name' => 'Engineer '.bin2hex(random_bytes(3)), 'is_active' => true]);
        $project->engineers()->attach($engineer->id, ['allocation_percent' => $percent]);
        return $engineer;
    }

    private function task(Project $project, Engineer $engineer, User $creator, string $type = 'job'): Task
    {
        $task = Task::query()->create([
            'project_id' => $project->id, 'assignee_engineer_id' => $engineer->id,
            'title' => 'Pekerjaan uji', 'type' => $type,
            'status' => 'todo', 'due_date' => '2026-10-28', 'created_by' => $creator->id,
        ]);
        if ($type === 'field_verification') {
            $task->verification()->create(['site_name' => 'Fasilitas Dummy', 'visit_date' => '2026-10-28']);
        }
        return $task;
    }

    public function test_guest_and_viewer_cannot_access_team_modules(): void
    {
        $this->getJson('/api/tasks')->assertUnauthorized();
        $this->getJson('/api/field-verifications')->assertUnauthorized();
        $this->actingAs($this->user('viewer'));
        $this->getJson('/api/tasks')->assertForbidden();
        $this->getJson('/api/field-verifications')->assertForbidden();
        $this->getJson('/api/field-verifications/candidates?project_id=1')->assertForbidden();
    }

    public function test_engineer_only_reads_own_assigned_tasks_and_cannot_create(): void
    {
        $project = $this->project();
        $otherProject = $this->project('PRJ-M2-B');
        $engineer = $this->assignment($project);
        $other = $this->assignment($otherProject);
        $creator = $this->user('coordinator');
        $myTask = $this->task($project, $engineer, $creator);
        $otherTask = $this->task($otherProject, $other, $creator, 'field_verification');
        $this->actingAs($this->user('engineer', $engineer));

        $this->getJson('/api/tasks')->assertOk()->assertJsonCount(1, 'tasks')
            ->assertJsonPath('tasks.0.id', $myTask->id);
        $this->getJson('/api/tasks/'.$otherTask->id)->assertForbidden();
        $this->getJson('/api/field-verifications')->assertOk()->assertJsonCount(0, 'verifications');
        $this->getJson('/api/field-verifications/'.$otherTask->verification->id)->assertForbidden();
        $this->postJson('/api/tasks', [])->assertForbidden();
        $this->getJson('/api/field-verifications/candidates?project_id='.$project->id)->assertForbidden();
        $this->patchJson('/api/tasks/'.$otherTask->id.'/status', ['status' => 'doing'])->assertForbidden();
        $this->patchJson('/api/tasks/'.$myTask->id.'/status', ['status' => 'doing'])
            ->assertOk()->assertJsonPath('task.status', 'doing');
        $this->assertDatabaseHas('activity_logs', ['project_id' => $project->id, 'field' => 'task_status']);
    }

    public function test_manager_creates_task_with_validation_and_activity_log(): void
    {
        $project = $this->project();
        $assigned = $this->assignment($project);
        $other = Engineer::query()->create(['name' => 'Tidak Ditugaskan', 'is_active' => true]);
        $this->actingAs($this->user('director'));
        $data = [
            'project_id' => $project->id, 'assignee_engineer_id' => $other->id,
            'title' => 'Analisis dokumen', 'type' => 'job', 'due_date' => '2026-10-29',
        ];
        $this->postJson('/api/tasks', $data)->assertUnprocessable()->assertJsonValidationErrors('assignee_engineer_id');
        $data['assignee_engineer_id'] = $assigned->id;
        $this->postJson('/api/tasks', $data)->assertCreated()
            ->assertJsonPath('task.status', 'todo')
            ->assertJsonPath('task.project_code', 'PRJ-M2-A');
        $this->assertDatabaseHas('tasks', ['project_id' => $project->id, 'title' => 'Analisis dokumen']);
        $this->assertDatabaseHas('activity_logs', ['project_id' => $project->id, 'field' => 'task_created']);
        $this->getJson('/api/tasks?project_id='.$project->id.'&status=todo')
            ->assertOk()->assertJsonCount(1, 'tasks');
    }

    public function test_field_candidates_sorted_and_capacity_rule_enforced(): void
    {
        $project = $this->project();
        $free = $this->assignment($project, 20);
        $busy = $this->assignment($project, 80);
        $manager = $this->user('coordinator');
        $this->actingAs($manager);
        $response = $this->getJson('/api/field-verifications/candidates?project_id='.$project->id)->assertOk();
        $this->assertSame($free->id, $response->json('candidates.0.engineer_id'));
        $this->assertTrue($response->json('candidates.0.is_available'));
        $this->assertSame(80, $response->json('candidates.1.total_allocation_percent'));
        $this->assertFalse($response->json('candidates.1.is_available'));
        $body = [
            'project_id' => $project->id, 'assignee_engineer_id' => $busy->id,
            'title' => 'Kunjungan lapangan', 'type' => 'field_verification',
            'due_date' => '2026-10-29',
            'field_verification' => ['site_name' => 'Area dummy', 'visit_date' => '2026-10-28'],
        ];
        $this->postJson('/api/tasks', $body)->assertUnprocessable()->assertJsonValidationErrors('assignee_engineer_id');
        $body['assignee_engineer_id'] = $free->id;
        $this->postJson('/api/tasks', $body)->assertCreated()->assertJsonPath('task.review_status', 'pending');
        $this->assertDatabaseCount('field_verifications', 1);
    }

    public function test_engineer_submits_manager_approves_findings_exactly_once(): void
    {
        $project = $this->project();
        $engineer = $this->assignment($project);
        $manager = $this->user('coordinator');
        $task = $this->task($project, $engineer, $manager, 'field_verification');
        $id = $task->verification->id;
        $this->actingAs($this->user('engineer', $engineer));
        $this->patchJson('/api/tasks/'.$task->id.'/status', ['status' => 'done'])
            ->assertUnprocessable();
        $this->patchJson('/api/field-verifications/'.$id.'/review', ['decision' => 'verify'])->assertForbidden();
        $this->patchJson('/api/field-verifications/'.$id.'/submit', [
            'result' => 'findings', 'findings_count' => 3, 'notes' => 'Tiga temuan perlu ditindaklanjuti.',
        ])->assertOk()->assertJsonPath('verification.review_status', 'submitted');
        $this->assertSame(0, $project->fresh()->findings_open);
        $this->patchJson('/api/field-verifications/'.$id.'/submit', [
            'result' => 'findings', 'findings_count' => 3, 'notes' => 'Coba kirim ulang',
        ])->assertUnprocessable();
        $this->actingAs($manager);
        $this->patchJson('/api/field-verifications/'.$id.'/review', ['decision' => 'verify'])
            ->assertOk()->assertJsonPath('verification.review_status', 'verified');
        $this->assertSame(3, $project->fresh()->findings_open);
        $this->assertSame(2, $project->fresh()->version);
        $this->assertSame('done', $task->fresh()->status);
        $this->assertDatabaseHas('field_verifications', ['id' => $id, 'applied_findings_count' => 3]);
        $this->patchJson('/api/field-verifications/'.$id.'/review', ['decision' => 'verify'])
            ->assertUnprocessable();
        $this->assertSame(3, $project->fresh()->findings_open);
    }

    public function test_send_back_requires_note_and_engineer_can_resubmit(): void
    {
        $project = $this->project();
        $engineer = $this->assignment($project);
        $manager = $this->user('director');
        $task = $this->task($project, $engineer, $manager, 'field_verification');
        $id = $task->verification->id;
        $engineerUser = $this->user('engineer', $engineer);
        $this->actingAs($engineerUser);
        $this->patchJson('/api/field-verifications/'.$id.'/submit', [
            'result' => 'confirmed', 'findings_count' => 0, 'notes' => 'Semua item telah dicek.',
        ])->assertOk();
        $this->actingAs($manager);
        $this->patchJson('/api/field-verifications/'.$id.'/review', [
            'decision' => 'revision_needed',
        ])->assertUnprocessable()->assertJsonValidationErrors('review_note');
        $this->patchJson('/api/field-verifications/'.$id.'/review', [
            'decision' => 'revision_needed', 'review_note' => 'Mohon perjelas bukti pemeriksaan.',
        ])->assertOk()->assertJsonPath('verification.review_status', 'revision_needed');
        $this->actingAs($engineerUser);
        $this->patchJson('/api/field-verifications/'.$id.'/submit', [
            'result' => 'findings', 'findings_count' => 1, 'notes' => 'Ada satu item perlu perbaikan.',
        ])->assertOk()->assertJsonPath('verification.review_status', 'submitted');
        $this->actingAs($manager);
        $this->patchJson('/api/field-verifications/'.$id.'/review', ['decision' => 'verify'])
            ->assertOk()->assertJsonPath('verification.review_status', 'verified');
        $this->assertSame(1, $project->fresh()->findings_open);
    }

    public function test_submission_validation_and_access_expiration(): void
    {
        $project = $this->project();
        $engineer = $this->assignment($project);
        $manager = $this->user('coordinator');
        $task = $this->task($project, $engineer, $manager, 'field_verification');
        $this->actingAs($this->user('engineer', $engineer));
        $this->patchJson('/api/field-verifications/'.$task->verification->id.'/submit', [
            'result' => 'confirmed', 'findings_count' => 5, 'notes' => 'Sesuai',
        ])->assertUnprocessable()->assertJsonValidationErrors('findings_count');
        $this->patchJson('/api/field-verifications/'.$task->verification->id.'/submit', [
            'result' => 'findings', 'findings_count' => 0, 'notes' => 'Temuan',
        ])->assertUnprocessable()->assertJsonValidationErrors('findings_count');
        $this->actingAs($this->user('engineer', $engineer, true));
        $this->getJson('/api/tasks')->assertForbidden()->assertJsonPath('code', 'PASSWORD_CHANGE_REQUIRED');
    }
}
