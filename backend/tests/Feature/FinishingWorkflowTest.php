<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Engineer;
use Database\Seeders\UserSeeder;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FinishingWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, bool $active = true): User
    {
        return User::query()->create([
            'name' => 'Demo '.ucfirst($role),
            'username' => $role.'.'.bin2hex(random_bytes(4)),
            'role' => $role,
            'is_active' => $active,
            'must_change_password' => false,
            'password' => 'TestPassword12!',
        ]);
    }

    public function test_history_is_read_only_and_role_restricted(): void
    {
        $this->getJson('/api/activity-logs')->assertUnauthorized();
        $this->actingAs($this->user('viewer'))
            ->getJson('/api/activity-logs')->assertForbidden();
        $this->actingAs($this->user('engineer'))
            ->getJson('/api/activity-logs')->assertForbidden();

        $project = Project::query()->create([
            'code' => 'PRJ-M4-1', 'name' => 'Demo M4', 'client' => 'Klien Demo', 'status' => 'on_track',
        ]);
        $coordinator = $this->user('coordinator');
        ActivityLog::query()->create([
            'user_id' => $coordinator->id, 'project_id' => $project->id,
            'field' => 'status', 'old_value' => 'on_track', 'new_value' => 'at_risk',
        ]);
        ActivityLog::query()->create([
            'user_id' => $coordinator->id, 'field' => 'password_reset', 'new_value' => 'user:11',
        ]);

        $this->actingAs($this->user('director'))
            ->getJson('/api/activity-logs?project_id='.$project->id)
            ->assertOk()->assertJsonPath('total', 1)
            ->assertJsonPath('entries.0.field', 'status')
            ->assertJsonPath('entries.0.project.code', 'PRJ-M4-1');
        $this->getJson('/api/activity-logs?user_id='.$coordinator->id.'&field=password_reset')
            ->assertOk()->assertJsonPath('total', 1);
        $this->postJson('/api/activity-logs', [])->assertStatus(405);
        $this->getJson('/api/activity-logs?page=0')->assertUnprocessable();
    }

    public function test_account_access_reset_and_deactivation(): void
    {
        $this->getJson('/api/users')->assertUnauthorized();
        $director = $this->user('director');
        $this->actingAs($director)->getJson('/api/users')->assertForbidden();
        $this->actingAs($this->user('engineer'))->getJson('/api/users')->assertForbidden();
        $this->actingAs($this->user('viewer'))->getJson('/api/users')->assertForbidden();

        $coordinator = $this->user('coordinator');
        $engineer = $this->user('engineer');
        $this->actingAs($coordinator)
            ->getJson('/api/users')->assertOk()->assertJsonFragment(['username' => $engineer->username]);
        $this->patchJson('/api/users/'.$coordinator->id.'/deactivate')->assertForbidden();
        $this->patchJson('/api/users/'.$engineer->id.'/deactivate')
            ->assertOk()->assertJsonPath('user.is_active', false);
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $coordinator->id, 'field' => 'account_deactivated',
        ]);
        $this->postJson('/api/auth/users/'.$engineer->id.'/reset-password')->assertForbidden();

// Kembalikan guard ke web dan simulasi login sebagai guest.
auth()->shouldUse('web');
auth('web')->logout();

$this->postJson('/api/auth/login', [
    'username' => $engineer->username, 'password' => 'TestPassword12!',
])->assertUnprocessable();
    }

    public function test_cannot_deactivate_last_active_admin(): void
    {
        $admin = $this->user('admin');
        $coordinator = $this->user('coordinator');
        $this->actingAs($coordinator)
            ->patchJson('/api/users/'.$admin->id.'/deactivate')
            ->assertUnprocessable();
        $this->assertTrue($admin->fresh()->is_active);
    }

    public function test_account_reset_still_uses_m1_policy_and_forces_password_change(): void
    {
        $admin = $this->user('admin');
        $user = $this->user('viewer');
        $password = $this->actingAs($admin)
            ->postJson('/api/auth/users/'.$user->id.'/reset-password')
            ->assertOk()->json('temporary_password');
        $this->assertSame(12, strlen($password));
        $this->assertTrue(Hash::check($password, $user->fresh()->password));
        $this->assertTrue($user->fresh()->must_change_password);
    }

    public function test_demo_seeder_maps_engineer_by_name_not_numeric_id(): void
    {
        // Test only with in-memory SQLite; the seeder itself remains local-only.
        app()->detectEnvironment(fn () => 'local');
        Engineer::query()->create(['name' => 'Unrelated Engineer']);
        $andi = Engineer::query()->create(['name' => 'Andi Pratama']);
        $budi = Engineer::query()->create(['name' => 'Budi Santoso']);
        $this->artisan('db:seed', ['--class' => 'UserSeeder'])->assertSuccessful();
        $this->assertSame($andi->id, User::query()->where('username', 'andi.p')->firstOrFail()->engineer_id);
        $this->assertSame($budi->id, User::query()->where('username', 'budi.s')->firstOrFail()->engineer_id);
        $original = User::query()->where('username', 'andi.p')->firstOrFail()->password;
        $this->artisan('db:seed', ['--class' => 'UserSeeder'])->assertSuccessful();
        $this->assertSame($original, User::query()->where('username', 'andi.p')->firstOrFail()->password);
    }

    public function test_demo_seeder_fails_when_engineer_missing(): void
    {
        app()->detectEnvironment(fn () => 'local');
        $this->expectException(\RuntimeException::class);
        (new UserSeeder())->run();
    }

    public function test_demo_refresh_defaults_to_preview_and_preserves_dates(): void
    {
        app()->detectEnvironment(fn () => 'local');
        $codes = ['PRJ-2417', 'INS-2409', 'ENG-2412', 'PRJ-2502',
            'INS-2508', 'ENG-2510', 'PRJ-2603', 'INS-2607'];
        foreach ($codes as $code) {
            Project::query()->create([
                'code' => $code, 'name' => 'Demo '.$code,
                'client' => 'Perusahaan Demo', 'status' => 'on_track',
                'next_milestone_date' => '2026-10-23',
            ]);
        }
        $this->artisan('demo:prepare-presentation')->assertSuccessful();
        $this->assertSame(8, Project::query()->whereDate('next_milestone_date', '2026-10-23')->count());
        $this->assertDatabaseCount('activity_logs', 0);
    }
}
