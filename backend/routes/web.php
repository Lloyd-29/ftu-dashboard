<?php
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;
Route::get('/',fn () => view('welcome'));
Route::prefix('api/auth')->group(function (): void {
    Route::post('login',[AuthController::class,'login']);
    Route::middleware('auth')->group(function (): void {
        Route::get('me',[AuthController::class,'me']);
        Route::post('password',[AuthController::class,'changePassword']);
        Route::post('logout',[AuthController::class,'logout']);
        Route::post('users/{user}/reset-password',[AuthController::class,'resetPassword']);
    });
});
