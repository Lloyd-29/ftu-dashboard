<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->is_active) {
            abort(403, 'Akun dinonaktifkan.');
        }
        if ($request->user()->must_change_password) {
            return response()->json([
                'message' => 'Ganti kata sandi sementara sebelum melanjutkan.',
                'code' => 'PASSWORD_CHANGE_REQUIRED',
            ], 403);
        }
        return $next($request);
    }
}
