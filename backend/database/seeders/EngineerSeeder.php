<?php

namespace Database\Seeders;

use App\Models\Engineer;
use Illuminate\Database\Seeder;

class EngineerSeeder extends Seeder
{
    public function run(): void
    {
        $names = [
            'Andi Pratama',
            'Budi Santoso',
            'Citra Maharani',
            'Dimas Saputra',
            'Eka Putri',
            'Fajar Ramadhan',
            'Gita Permata',
            'Hendra Wijaya',
            'Intan Lestari',
            'Joko Firmansyah',
        ];

        foreach ($names as $name) {
            Engineer::query()->firstOrCreate(
                ['name' => $name],
                ['is_active' => true],
            );
        }
    }
}