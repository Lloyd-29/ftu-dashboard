<?php
namespace App\Providers;
use App\Models\Project;
use App\Models\User;
use App\Policies\ProjectPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}
    public function boot(): void
    {
        Gate::policy(Project::class,ProjectPolicy::class);
        Gate::policy(User::class,UserPolicy::class);
        Gate::define('view-dashboard',fn (User $user): bool => $user->is_active && !$user->must_change_password && in_array($user->role,['admin','coordinator','director','viewer'],true));
    }
}
