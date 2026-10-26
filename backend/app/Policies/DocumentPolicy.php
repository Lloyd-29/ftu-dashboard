<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

class DocumentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && ! $user->must_change_password && $user->role !== 'viewer';
    }

    public function view(User $user, Document $document): bool
    {
        if (! $this->viewAny($user)) return false;
        if ($user->canManageProjects()) return true;
        return $user->role === 'engineer' && (
            ($user->engineer_id !== null && $document->project->engineers()->whereKey($user->engineer_id)->exists())
            || $document->revisions()->where('uploaded_by', $user->id)->exists()
        );
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function upload(User $user, Document $document): bool
    {
        if (! $this->viewAny($user)) return false;
        if ($user->canManageProjects()) return true;
        return $user->role === 'engineer' && $user->engineer_id !== null
            && $document->project->engineers()->whereKey($user->engineer_id)->exists();
    }

    public function review(User $user, Document $document): bool
    {
        return $this->view($user, $document) && $user->canManageProjects();
    }
}
