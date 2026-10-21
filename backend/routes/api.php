<?php

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\FieldVerificationController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;

Route::get('/health', static function (): JsonResponse {
    try { DB::select('SELECT 1'); }
    catch (Throwable $exception) { report($exception); return response()->json(['status'=>'unavailable'],503); }
    return response()->json(['status'=>'ok','database'=>'connected']);
});

Route::middleware(['auth:sanctum','password.changed'])->group(function (): void {
    Route::get('/dashboard', function () { Gate::authorize('view-dashboard'); return app(DashboardController::class)(); });
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::put('/projects/{project}', [ProjectController::class, 'update']);
    Route::get('/engineers', [ProjectController::class, 'engineers']);

    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::get('/tasks/{task}', [TaskController::class, 'show']);
    Route::patch('/tasks/{task}/status', [TaskController::class, 'updateStatus']);

    Route::get('/field-verifications/candidates', [FieldVerificationController::class, 'candidates']);
    Route::get('/field-verifications', [FieldVerificationController::class, 'index']);
    Route::get('/field-verifications/{verification}', [FieldVerificationController::class, 'show']);
    Route::patch('/field-verifications/{verification}/submit', [FieldVerificationController::class, 'submit']);
    Route::patch('/field-verifications/{verification}/review', [FieldVerificationController::class, 'review']);
});
