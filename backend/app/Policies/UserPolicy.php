<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->is_active && ! $actor->must_change_password
            && in_array($actor->role, ['admin', 'coordinator'], true);
    }

    public function resetPassword(User $actor, User $subject): bool
    {
        return $this->viewAny($actor) && $subject->is_active && $actor->id !== $subject->id;
    }

    public function deactivate(User $actor, User $subject): bool
    {
        return $this->viewAny($actor) && $subject->is_active && $actor->id !== $subject->id;
    }
}
