<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable()->change();
            $table->string('username', 80)->nullable()->unique();
            $table->foreignId('engineer_id')->nullable()->constrained('engineers')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->boolean('must_change_password')->default(true);
        });

        Schema::table('engineers', function (Blueprint $table): void {
            $table->string('initials', 12)->nullable();
        });

        // Keep every demo user, project reference and audit reference intact.
        $taken = [];
        foreach (DB::table('users')->orderBy('id')->get() as $user) {
            $base = Str::lower((string) (Str::before((string) $user->email, '@') ?: $user->name));
            $base = trim((string) preg_replace('/[^a-z0-9._-]+/', '.', $base), '.');
            $base = substr($base ?: 'user', 0, 60);
            $name = $base;
            while (isset($taken[$name]) || DB::table('users')->where('username', $name)->exists()) {
                $name = $base.'.'.$user->id;
            }
            $taken[$name] = true;
            $role = $user->role === 'editor'
                ? (str_contains(Str::lower($user->name.' '.$user->email), 'direktur')
                    || str_contains(Str::lower($user->name.' '.$user->email), 'director')
                    ? 'director' : 'coordinator')
                : $user->role;
            DB::table('users')->where('id', $user->id)->update(['username' => $name, 'role' => $role]);
        }
    }

    public function down(): void
    {
        // The previous schema requires email for all accounts. Do not discard active identities.
        if (DB::table('users')->whereNull('email')->exists()) {
            throw new RuntimeException('Rollback blocked: users without email exist. Restore DB backup instead.');
        }
        DB::table('users')->whereIn('role', ['coordinator', 'director'])->update(['role' => 'editor']);
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('engineer_id');
            $table->dropColumn(['username', 'is_active', 'must_change_password']);
            $table->string('email')->nullable(false)->change();
        });
        Schema::table('engineers', fn (Blueprint $table) => $table->dropColumn('initials'));
    }
};
