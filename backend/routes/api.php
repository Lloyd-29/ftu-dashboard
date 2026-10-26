<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\FieldVerificationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
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

    Route::get('/documents/types', [DocumentController::class, 'types']);
    Route::put('/documents/types', [DocumentController::class, 'updateTypes']);
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::get('/documents/{document}', [DocumentController::class, 'show']);
    Route::post('/documents/{document}/revisions', [DocumentController::class, 'addRevision']);
    Route::patch('/document-revisions/{revision}/review', [DocumentController::class, 'review']);
    Route::get('/document-revisions/{revision}/download', [DocumentController::class, 'download']);
    Route::delete('/document-revisions/{revision}', [DocumentController::class, 'destroyRevision']);

    Route::get('/field-verifications/candidates', [FieldVerificationController::class, 'candidates']);
    Route::get('/field-verifications', [FieldVerificationController::class, 'index']);
    Route::get('/field-verifications/{verification}', [FieldVerificationController::class, 'show']);
    Route::patch('/field-verifications/{verification}/submit', [FieldVerificationController::class, 'submit']);
    Route::patch('/field-verifications/{verification}/review', [FieldVerificationController::class, 'review']);

    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
    Route::get('/users', [AccountController::class, 'index']);
    Route::patch('/users/{user}/deactivate', [AccountController::class, 'deactivate']);
});
