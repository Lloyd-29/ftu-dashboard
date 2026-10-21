<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Engineer;
use App\Models\User;
use App\Support\TemporaryPassword;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ImportUsers extends Command
{
    protected $signature = 'users:import {file : CSV file within container} {--reset-existing : Replace existing passwords explicitly}';
    protected $description = 'Create FTU accounts with unique 12-character temporary passwords shown once';

    public function handle(): int
    {
        $filename = $this->argument('file');
        if (! is_file($filename) || ! is_readable($filename)) {
            $this->error('CSV file could not be read.');
            return self::FAILURE;
        }
        $handle = fopen($filename, 'rb');
        if ($handle === false) return self::FAILURE;
        try {
            $headers = fgetcsv($handle);
            if (! is_array($headers)) throw new InvalidArgumentException('CSV header is missing.');
            $headers[0] = ltrim($headers[0], "\xEF\xBB\xBF");
            $required = ['name','username','role','engineer_id','initials'];
            if ($headers !== $required) throw new InvalidArgumentException('CSV columns must be: '.implode(',', $required));
            $items = [];
            $seen = [];
            while (($row = fgetcsv($handle)) !== false) {
                if ($row === [null]) continue;
                if (count($row) !== 5) throw new InvalidArgumentException('Invalid column count.');
                $item = array_combine($headers, array_map('trim', $row));
                $item['username'] = mb_strtolower($item['username']);
                if (mb_strlen($item['name']) < 1 || mb_strlen($item['name']) > 255
                    || ! preg_match('/^[a-z0-9][a-z0-9._-]{1,79}$/D', $item['username'])
                    || ! in_array($item['role'], ['admin','coordinator','director','engineer','viewer'], true)
                    || mb_strlen($item['initials']) > 12 || isset($seen[$item['username']])) {
                    throw new InvalidArgumentException('Invalid name, username, role, initials or duplicate username.');
                }
                $seen[$item['username']] = true;
                if ($item['engineer_id'] !== '') {
                    if (! ctype_digit($item['engineer_id']) || $item['role'] !== 'engineer'
                        || ! Engineer::query()->whereKey((int) $item['engineer_id'])->exists()) {
                        throw new InvalidArgumentException('Engineer ID does not exist or role is not engineer.');
                    }
                } elseif ($item['role'] === 'engineer') {
                    throw new InvalidArgumentException('Engineer account must have engineer_id.');
                }
                $items[] = $item;
            }
            $shown = DB::transaction(function () use ($items): array {
                $passwords = [];
                foreach ($items as $item) {
                    $existing = User::query()->where('username', $item['username'])->first();
                    if ($existing && ! $this->option('reset-existing')) continue;
                    do { $password = TemporaryPassword::generate(); }
                    while (in_array($password, array_column($passwords, 1), true));
                    $user = $existing ?? new User();
                    $user->name = $item['name'];
                    $user->username = $item['username'];
                    $user->role = $item['role'];
                    $user->engineer_id = $item['engineer_id'] !== '' ? (int) $item['engineer_id'] : null;
                    $user->password = $password;
                    $user->must_change_password = true;
                    $user->is_active = true;
                    $user->remember_token = null;
                    $user->save();
                    if ($user->engineer_id !== null && $item['initials'] !== '') {
                        Engineer::query()->whereKey($user->engineer_id)->update(['initials'=>$item['initials']]);
                    }
                    if (! $existing) {
                        ActivityLog::create(['user_id'=>$user->id,'field'=>'account_created','new_value'=>'cli_import']);
                    }
                    if ($existing) {
                        DB::table('sessions')->where('user_id', $user->id)->delete();
                        ActivityLog::create(['user_id'=>$user->id,'field'=>'password_reset','new_value'=>'cli_import']);
                    }
                    $passwords[] = [$user->username, $password];
                }
                return $passwords;
            });
            foreach ($shown as [$username, $password]) {
                $this->line($username.' : '.$password);
            }
            $this->info(count($shown).' account(s) created/reset. Passwords shown once; do not save in the repository.');
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        } finally {
            fclose($handle);
        }
    }
}
