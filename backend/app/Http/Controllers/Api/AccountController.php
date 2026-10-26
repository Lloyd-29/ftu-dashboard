<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class AccountController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', User::class);
        return response()->json(['users' => User::query()
            ->with('engineer:id,name,initials')
            ->orderBy('name')->get()->map(fn (User $user) => $this->display($user))->values(),
        ])->header('Cache-Control', 'no-store');
    }

    public function deactivate(Request $request, User $user): JsonResponse
    {
        Gate::authorize('deactivate', $user);

        DB::transaction(function () use ($request, $user): void {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            if (! $locked->is_active) {
                throw ValidationException::withMessages(['user' => 'Akun sudah nonaktif.']);
            }
            if ($locked->role === 'admin' && User::query()->where('role', 'admin')->where('is_active', true)->count() < 2) {
                throw ValidationException::withMessages(['user' => 'Administrator aktif terakhir tidak boleh dinonaktifkan.']);
            }
            $locked->is_active = false;
            $locked->remember_token = null;
            $locked->save();
            DB::table('sessions')->where('user_id', $locked->id)->delete();
            $log = new ActivityLog();
            $log->user_id = $request->user()->id;
            $log->field = 'account_deactivated';
            $log->new_value = 'user:'.$locked->id;
            $log->save();
        }, 3);

        return response()->json(['user' => $this->display($user->fresh())]);
    }

    private function display(User $user): array
    {
        return [
            'id' => $user->id, 'name' => $user->name, 'username' => $user->username,
            'role' => $user->role, 'is_active' => (bool) $user->is_active,
            'must_change_password' => (bool) $user->must_change_password,
            'engineer_name' => $user->engineer?->name,
        ];
    }
}
