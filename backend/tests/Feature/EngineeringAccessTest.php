<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Engineer;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EngineeringAccessTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, ?int $engineerId = null, bool $mustChange = false): User
    {
        return User::query()->create([
            'name' => ucfirst($role),
            'username' => $role.'.'.bin2hex(random_bytes(3)),
            'email' => null,
            'role' => $role,
            'engineer_id' => $engineerId,
            'is_active' => true,
            'must_change_password' => $mustChange,
            'password' => 'ExamplePassword12!',
        ]);
    }

    private function project(): Project
    {
        return Project::query()->create([
            'code'=>'PRJ-TST-001', 'name'=>'Demo Project', 'client'=>'Klien Demo',
            'status'=>'on_track', 'progress_percent'=>null,
        ]);
    }

    public function test_guest_cannot_read_dashboard_or_projects(): void
    {
        $this->getJson('/api/dashboard')->assertUnauthorized();
        $this->getJson('/api/projects')->assertUnauthorized();
        $this->getJson('/api/health')->assertOk();
    }

    public function test_login_forced_password_change_then_session_access(): void
    {
        $user=$this->user('coordinator',null,true);
        $this->postJson('/api/auth/login',['username'=>$user->username,'password'=>'bad'])
            ->assertUnprocessable();
        $this->postJson('/api/auth/login',['username'=>$user->username,'password'=>'ExamplePassword12!'])
            ->assertOk()->assertJsonPath('user.must_change_password',true);
        $this->getJson('/api/projects')->assertForbidden()->assertJsonPath('code','PASSWORD_CHANGE_REQUIRED');
        $this->postJson('/api/auth/password',[
            'current_password'=>'ExamplePassword12!',
            'password'=>'FreshPassword0987!',
            'password_confirmation'=>'FreshPassword0987!',
        ])->assertOk()->assertJsonPath('user.must_change_password',false);
        $this->getJson('/api/projects')->assertOk();
        $this->assertTrue(Hash::check('FreshPassword0987!',$user->fresh()->password));
        $this->assertDatabaseHas('activity_logs',['user_id'=>$user->id,'field'=>'password_changed']);
        $this->postJson('/api/auth/logout')->assertOk();

// Simulasikan request HTTP baru tanpa cache user Sanctum.
$this->app['auth']->guard('sanctum')->forgetUser();

$this->getJson('/api/projects')->assertUnauthorized();
    }

    public function test_roles_and_assigned_project_visibility(): void
    {
        $mine=$this->project();
        $other=Project::query()->create(['code'=>'PRJ-TST-002','name'=>'Other','client'=>'Dummy','status'=>'at_risk']);
        $engineer=Engineer::query()->create(['name'=>'One Engineer']);
        $mine->engineers()->attach($engineer->id,['allocation_percent'=>50]);
        $viewer=$this->user('viewer');
        $this->actingAs($viewer)->getJson('/api/dashboard')->assertOk();
        $this->getJson('/api/projects')->assertForbidden();
        $this->actingAs($this->user('engineer',$engineer->id));
        $this->getJson('/api/dashboard')->assertForbidden();
        $this->getJson('/api/projects')->assertOk()->assertJsonCount(1,'projects');
        $this->getJson('/api/projects/'.$mine->id)->assertOk();
        $this->getJson('/api/projects/'.$other->id)->assertForbidden();
        $this->putJson('/api/projects/'.$mine->id,['version'=>1,'status'=>'delayed'])->assertForbidden();
        $this->getJson('/api/engineers')->assertForbidden();
    }

    public function test_director_and_coordinator_can_save_project_with_locking_and_audit(): void
    {
        $project=$this->project();
        $engineer=Engineer::query()->create(['name'=>'Eng A']);
        $this->actingAs($this->user('director'));
        $payload=[
            'version'=>1,'status'=>'delayed','progress_percent'=>null,
            'planned_progress_percent'=>40,'sop_phase'=>'Review',
            'findings_open'=>2,'findings_closed'=>1,
            'engineers'=>[['engineer_id'=>$engineer->id,'allocation_percent'=>40]],
            'note'=>['note_date'=>'2026-10-22','body'=>'Klien minta pengecekan'],
            'alerts'=>[['title'=>'Akan terlambat','severity'=>'warning','due_date'=>'2026-10-28','is_resolved'=>false]],
        ];
        $this->putJson('/api/projects/'.$project->id,$payload)->assertOk()
            ->assertJsonPath('project.version',2)
            ->assertJsonPath('project.progress_percent',null)
            ->assertJsonCount(1,'project.notes')
            ->assertJsonCount(1,'project.alerts');
        $this->assertDatabaseHas('projects',['id'=>$project->id,'status'=>'delayed','version'=>2]);
        $this->assertDatabaseHas('project_notes',['project_id'=>$project->id,'body'=>'Klien minta pengecekan']);
        $this->assertDatabaseHas('project_engineer',['project_id'=>$project->id,'engineer_id'=>$engineer->id]);
        $this->assertTrue(ActivityLog::query()->where('project_id',$project->id)->where('field','engineers')->exists());
        $this->putJson('/api/projects/'.$project->id,$payload)->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->putJson('/api/projects/'.$project->id,['version'=>2,'progress_percent'=>101])->assertUnprocessable();
        $this->actingAs($this->user('coordinator'))->putJson('/api/projects/'.$project->id,['version'=>2,'status'=>'on_track'])
            ->assertOk()->assertJsonPath('project.version',3);
    }

    public function test_admin_can_reset_password_but_director_cannot(): void
    {
        $subject=$this->user('engineer',Engineer::query()->create(['name'=>'Eng B'])->id);
        $admin=$this->user('admin');
        $this->actingAs($this->user('director'));
        $this->postJson('/api/auth/users/'.$subject->id.'/reset-password')->assertForbidden();
        $this->actingAs($admin);
        $response=$this->postJson('/api/auth/users/'.$subject->id.'/reset-password')->assertOk();
        $temporary=$response->json('temporary_password');
        $this->assertSame(12,strlen($temporary));
        $this->assertTrue(Hash::check($temporary,$subject->fresh()->password));
        $this->assertTrue($subject->fresh()->must_change_password);
        $this->assertDatabaseHas('activity_logs',['user_id'=>$admin->id,'field'=>'password_reset']);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user=$this->user('admin');
        $user->is_active=false;$user->save();
        $this->postJson('/api/auth/login',['username'=>$user->username,'password'=>'ExamplePassword12!'])
            ->assertUnprocessable()->assertJsonPath('message','Username atau kata sandi tidak sesuai.');
    }
    public function test_login_is_rate_limited_per_username_and_ip(): void
    {
        $username='unknown.'.bin2hex(random_bytes(4));
        for ($attempt=0;$attempt<5;$attempt++) {
            $this->postJson('/api/auth/login',['username'=>$username,'password'=>'incorrect'])->assertUnprocessable();
        }
        $this->postJson('/api/auth/login',['username'=>$username,'password'=>'incorrect'])->assertStatus(429);
    }

    public function test_coordinator_can_reset_others_but_not_self(): void
    {
        $coordinator=$this->user('coordinator');
        $other=$this->user('viewer');
        $this->actingAs($coordinator)
            ->postJson('/api/auth/users/'.$other->id.'/reset-password')->assertOk();
        $this->postJson('/api/auth/users/'.$coordinator->id.'/reset-password')->assertForbidden();
    }
}
