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