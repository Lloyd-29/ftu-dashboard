<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && ! $user->must_change_password && $user->role !== 'viewer';
    }

    public function view(User $user, Task $task): bool
    {
        if (! $this->viewAny($user)) return false;
        if ($user->canManageProjects()) return true;
        return $user->role === 'engineer' && $user->engineer_id !== null
            && (int) $user->engineer_id === (int) $task->assignee_engineer_id
            && $task->project->engineers()->whereKey($user->engineer_id)->exists();
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user) && $user->canManageProjects();
    }

    public function updateStatus(User $user, Task $task): bool
    {
        return $this->view($user, $task);
    }
}
