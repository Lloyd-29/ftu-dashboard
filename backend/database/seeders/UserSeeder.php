<?php

namespace Database\Seeders;

use App\Models\Engineer;
use Illuminate\Database\Seeder;
use RuntimeException;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('Demo users only for local environment.');
        }

        $source = fopen(database_path('demo-users.csv'), 'rb');
        if ($source === false) {
            throw new RuntimeException('Demo CSV cannot be opened.');
        }

        $temporary = tempnam(sys_get_temp_dir(), 'ftu-demo-');
        if ($temporary === false) {
            fclose($source);
            throw new RuntimeException('Cannot prepare temporary demo CSV.');
        }

        try {
            $target = fopen($temporary, 'wb');
            if ($target === false) {
                throw new RuntimeException('Cannot write temporary demo CSV.');
            }
            try {
                $header = fgetcsv($source);
                if ($header !== ['name', 'username', 'role', 'engineer_id', 'initials']) {
                    throw new RuntimeException('Unexpected demo CSV columns.');
                }
                fputcsv($target, $header);
                while (($row = fgetcsv($source)) !== false) {
                    if ($row === [null]) {
                        continue;
                    }
                    if (count($row) !== 5) {
                        throw new RuntimeException('Invalid demo CSV row.');
                    }
                    if ($row[3] !== '') {
                        if ($row[2] !== 'engineer') {
                            throw new RuntimeException('Only engineer roles may have engineer names.');
                        }
                        // The demo template stores stable engineer names, not volatile numeric IDs.
                        $matching = Engineer::query()->where('name', trim($row[3]))->get(['id']);
                        if ($matching->count() !== 1) {
                            throw new RuntimeException('Demo engineer name missing or ambiguous: '.$row[3]);
                        }
                        $row[3] = (string) $matching->first()->id;
                    }
                    fputcsv($target, $row);
                }
            } finally {
                fclose($target);
            }

            // Import never resets existing accounts or their passwords.
            if (! $this->command) {
                throw new RuntimeException('Demo import requires an Artisan console context.');
            }
            $result = $this->command->call('users:import', ['file' => $temporary]);
            if ($result !== 0) {
                throw new RuntimeException('Demo user import failed; check the command error above.');
            }
        } finally {
            fclose($source);
            @unlink($temporary);
        }
    }
}
