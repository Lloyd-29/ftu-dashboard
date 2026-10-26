<?php

namespace App\Policies;

use App\Models\User;

class ActivityLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && ! $user->must_change_password
            && in_array($user->role, ['admin', 'coordinator', 'director'], true);
    }
}
