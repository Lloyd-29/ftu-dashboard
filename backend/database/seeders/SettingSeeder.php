<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            'slide_rotation_seconds' => '25',
            'stale_after_days' => '7',
        ];

        foreach ($settings as $key => $value) {
            Setting::query()->firstOrCreate(
                ['key' => $key],
                ['value' => $value],
            );
        }
    }
}