<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && ! $user->must_change_password && $user->role !== 'viewer';
    }

    public function view(User $user, Project $project): bool
    {
        if (! $this->viewAny($user)) return false;
        if ($user->canManageProjects()) return true;
        return $user->role === 'engineer' && $user->engineer_id !== null
            && $project->engineers()->whereKey($user->engineer_id)->exists();
    }

    public function update(User $user, Project $project): bool
    {
        return $user->is_active && ! $user->must_change_password && $user->canManageProjects();
    }
}
