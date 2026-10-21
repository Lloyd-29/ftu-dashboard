<?php

namespace App\Support;

use App\Models\ActivityLog;

final class TeamActivity
{
    public static function record(int $userId, int $projectId, string $field, mixed $before, mixed $after): void
    {
        ActivityLog::query()->create([
            'user_id' => $userId,
            'project_id' => $projectId,
            'field' => $field,
            'old_value' => $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
            'new_value' => $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
        ]);
    }
}
