<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Tests\TestCase;

class AuditAndSettingModelsTest extends TestCase
{
    public function test_activity_log_belongs_to_user_and_project(): void
    {
        $log = new ActivityLog();

        $this->assertInstanceOf(BelongsTo::class, $log->user());
        $this->assertInstanceOf(BelongsTo::class, $log->project());
    }

    public function test_user_and_project_expose_activity_logs(): void
    {
        $this->assertInstanceOf(
            HasMany::class,
            (new User())->activityLogs()
        );

        $this->assertInstanceOf(
            HasMany::class,
            (new Project())->activityLogs()
        );
    }

    public function test_activity_log_only_has_created_at_timestamp(): void
    {
        $log = new ActivityLog();

        $this->assertTrue($log->usesTimestamps());
        $this->assertSame('created_at', $log->getCreatedAtColumn());
        $this->assertNull($log->getUpdatedAtColumn());
    }

    public function test_setting_uses_string_primary_key(): void
    {
        $setting = new Setting([
            'key' => 'slide_rotation_seconds',
            'value' => '25',
        ]);

        $this->assertSame('settings', $setting->getTable());
        $this->assertSame('key', $setting->getKeyName());
        $this->assertFalse($setting->getIncrementing());
        $this->assertSame('string', $setting->getKeyType());
        $this->assertSame('25', $setting->value);
    }
}