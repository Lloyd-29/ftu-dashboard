<?php
namespace App\Policies;
use App\Models\User;
class UserPolicy
{
    public function resetPassword(User $actor, User $subject): bool
    {
        return $actor->is_active && ! $actor->must_change_password
            && $subject->is_active && $actor->id !== $subject->id
            && in_array($actor->role,['admin','coordinator'],true);
    }
}
