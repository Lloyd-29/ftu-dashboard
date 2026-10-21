<?php
namespace Tests\Feature;
use App\Models\Engineer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class ImportUsersTest extends TestCase
{
    use RefreshDatabase;
    public function test_cli_creates_unique_temporary_passwords_and_preserves_existing_users_without_reset_flag(): void
    {
        $engineer=Engineer::query()->create(['name'=>'Dummy A']);
        $file=tempnam(sys_get_temp_dir(),'ftuusers');
        file_put_contents($file,"name,username,role,engineer_id,initials\nDemo Engineer,demo.e,engineer,{$engineer->id},DE\nDemo Viewer,demo.tv,viewer,,\n");
        try {
            $this->artisan('users:import',['file'=>$file])->assertSuccessful();
            $this->assertSame(2,User::query()->count());
            $this->assertSame('DE',$engineer->fresh()->initials);
            $this->assertTrue(User::query()->where('username','demo.tv')->firstOrFail()->must_change_password);
            $this->artisan('users:import',['file'=>$file])->assertSuccessful();
            $this->assertSame(2,User::query()->count());
        } finally {unlink($file);}
    }
}
