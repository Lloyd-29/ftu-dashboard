<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string'],
        ]);
        $username = mb_strtolower(trim($data['username']));
        $key = 'login:'.hash('sha256', $username.'|'.$request->ip());
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Terlalu banyak percobaan. Coba lagi sebentar.'], 429);
        }
        if (! Auth::attempt(['username' => $username, 'password' => $data['password'], 'is_active' => true], false)) {
            RateLimiter::hit($key, 60);
            return response()->json(['message' => 'Username atau kata sandi tidak sesuai.'], 422);
        }
        RateLimiter::clear($key);
        $request->session()->regenerate();
        if ($request->user()->role === 'viewer') {
            Auth::login($request->user(), true);
        }
        return response()->json(['user' => $this->present($request->user())]);
    }

    public function me(Request $request): JsonResponse
    {
        if (! $request->user()?->is_active) {
            return response()->json(['message' => 'Akun dinonaktifkan.'], 403);
        }
        return response()->json(['user' => $this->present($request->user())]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user?->is_active, 403);
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ]);
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Kata sandi lama tidak sesuai.']);
        }
        if (mb_strtolower($data['password']) === mb_strtolower($user->username) || $data['password'] === $data['current_password']) {
            throw ValidationException::withMessages(['password' => 'Gunakan kata sandi baru yang berbeda dari username dan kata sandi sebelumnya.']);
        }
        $user->password = $data['password'];
        $user->must_change_password = false;
        $user->save();
        $request->session()->regenerate();
        ActivityLog::create(['user_id' => $user->id, 'field' => 'password_changed', 'new_value' => 'self']);
        return response()->json(['user' => $this->present($user)]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        Gate::authorize('resetPassword', $user);
        $password = \App\Support\TemporaryPassword::generate();
        $user->password = $password;
        $user->must_change_password = true;
        $user->remember_token = null;
        $user->save();
        \Illuminate\Support\Facades\DB::table('sessions')->where('user_id', $user->id)->delete();
        ActivityLog::create(['user_id' => $request->user()->id, 'field' => 'password_reset', 'old_value' => null, 'new_value' => 'user:'.$user->id]);
        // Display only once; never log or store plaintext.
        return response()->json(['temporary_password' => $password]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['message' => 'Berhasil keluar.']);
    }

    private function present(User $user): array
    {
        return $user->only(['id', 'name', 'username', 'role', 'engineer_id', 'must_change_password']);
    }
}
