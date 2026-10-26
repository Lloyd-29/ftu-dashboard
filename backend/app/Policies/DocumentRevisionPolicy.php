<?php

namespace App\Policies;

use App\Models\DocumentRevision;
use App\Models\User;

class DocumentRevisionPolicy
{
    public function view(User $user, DocumentRevision $revision): bool
    {
        if (! $user->can('view', $revision->document)) return false;
        if ($user->role !== 'engineer') return true;
        return ($user->engineer_id !== null && $revision->document->project->engineers()->whereKey($user->engineer_id)->exists())
            || (int) $revision->uploaded_by === (int) $user->id;
    }

    public function review(User $user, DocumentRevision $revision): bool
    {
        return $user->can('review', $revision->document);
    }

    public function delete(User $user, DocumentRevision $revision): bool
    {
        // Coordinator and technical admin only; checked revisions are immutable to other roles.
        return $user->is_active && ! $user->must_change_password
            && in_array($user->role, ['coordinator', 'admin'], true);
    }
}
