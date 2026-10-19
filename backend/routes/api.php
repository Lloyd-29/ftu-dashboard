<?php

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/health', static function (): JsonResponse {
    try {
        DB::select('SELECT 1');
    } catch (Throwable $exception) {
        report($exception);

        return response()->json([
            'status' => 'unavailable',
        ], 503);
    }

    return response()->json([
        'status' => 'ok',
        'database' => 'connected',
    ]);
});

// DEMO-ONLY: Public dashboard route for the local supervisor demo.
\Illuminate\Support\Facades\Route::get('/dashboard', \App\Http\Controllers\Api\DashboardController::class);