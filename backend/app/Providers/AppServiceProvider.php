<?php

namespace App\Providers;

use App\Models\FieldVerification;
use App\Models\Document;
use App\Models\DocumentRevision;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Policies\FieldVerificationPolicy;
use App\Policies\DocumentPolicy;
use App\Policies\DocumentRevisionPolicy;
use App\Policies\ProjectPolicy;
use App\Policies\TaskPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::policy(Project::class, ProjectPolicy::class);
        Gate::policy(Document::class, DocumentPolicy::class);
        Gate::policy(DocumentRevision::class, DocumentRevisionPolicy::class);
        Gate::policy(Task::class, TaskPolicy::class);
        Gate::policy(FieldVerification::class, FieldVerificationPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::define('view-dashboard', fn (User $user): bool =>
            $user->is_active && ! $user->must_change_password &&
            in_array($user->role, ['admin', 'coordinator', 'director', 'viewer'], true));
    }
}
