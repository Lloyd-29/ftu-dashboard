<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            [
                'name' => 'Admin Demo FTU',
                'email' => 'admin@ftu-demo.test',
                'role' => 'admin',
            ],
            [
                'name' => 'Kepala Engineering Demo',
                'email' => 'engineering@ftu-demo.test',
                'role' => 'editor',
            ],
            [
                'name' => 'Direktur Demo',
                'email' => 'director@ftu-demo.test',
                'role' => 'editor',
            ],
            [
                'name' => 'TV Dashboard Demo',
                'email' => 'tv@ftu-demo.test',
                'role' => 'viewer',
            ],
        ];

        foreach ($accounts as $account) {
            if (User::query()
                ->where('email', $account['email'])
                ->exists()) {
                continue;
            }

            $user = new User();

            $user->name = $account['name'];
            $user->email = $account['email'];
            $user->role = $account['role'];

            $user->password = bin2hex(random_bytes(24));

            $user->save();
        }
    }
}