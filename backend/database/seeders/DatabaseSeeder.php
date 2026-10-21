<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use RuntimeException;
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) throw new RuntimeException('Demo seeders may only run in the local environment.');
        $this->call([
            EngineerSeeder::class,
            UserSeeder::class,
            SettingSeeder::class,
            ProjectSeeder::class,
            ProjectEngineerSeeder::class,
            ProjectNoteSeeder::class,
            MilestoneSeeder::class,
            ProgressPointSeeder::class,
            AlertSeeder::class,
            ActivityLogSeeder::class,
        ]);
    }
}
