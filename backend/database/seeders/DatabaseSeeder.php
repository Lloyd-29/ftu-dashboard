<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException(
                'Demo seeders may only run in the local environment.'
            );
        }

        $this->call([
            UserSeeder::class,
            EngineerSeeder::class,
            SettingSeeder::class,
            ProjectSeeder::class,
            ProjectEngineerSeeder::class,
        ]);
    }
}