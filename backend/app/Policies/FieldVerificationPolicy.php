<?php

namespace App\Policies;

use App\Models\FieldVerification;
use App\Models\User;

class FieldVerificationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && ! $user->must_change_password && $user->role !== 'viewer';
    }

    public function view(User $user, FieldVerification $verification): bool
    {
        return $this->viewAny($user) && $user->can('view', $verification->task);
    }

    public function submit(User $user, FieldVerification $verification): bool
    {
        return $this->view($user, $verification) && $user->role === 'engineer'
            && (int) $user->engineer_id === (int) $verification->task->assignee_engineer_id;
    }

    public function review(User $user, FieldVerification $verification): bool
    {
        return $this->view($user, $verification) && $user->canManageProjects();
    }
}
