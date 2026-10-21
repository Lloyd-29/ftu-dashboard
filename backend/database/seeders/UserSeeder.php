<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use RuntimeException;
class UserSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) throw new RuntimeException('Demo users only for local environment.');
        // Import uses the same username-based CLI as office account provisioning.
        $this->command?->call('users:import', ['file'=>database_path('demo-users.csv')]);
    }
}
