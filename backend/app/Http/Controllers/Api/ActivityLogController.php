<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', ActivityLog::class);

        $filters = $request->validate([
            'project_id' => ['sometimes', 'nullable', 'integer', 'min:1', 'exists:projects,id'],
            'user_id' => ['sometimes', 'nullable', 'integer', 'min:1', 'exists:users,id'],
            'field' => ['sometimes', 'nullable', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
        ]);

        $page = ActivityLog::query()
            ->with(['user:id,name,username', 'project:id,code,name'])
            ->when($filters['project_id'] ?? null, fn ($query, $id) => $query->where('project_id', $id))
            ->when($filters['user_id'] ?? null, fn ($query, $id) => $query->where('user_id', $id))
            ->when($filters['field'] ?? null, fn ($query, $field) => $query->where('field', $field))
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(25);

        return response()->json([
            'entries' => $page->getCollection()->map(fn (ActivityLog $entry) => [
                'id' => $entry->id,
                'created_at' => $entry->created_at?->toIso8601String(),
                'field' => $entry->field,
                'old_value' => $entry->old_value,
                'new_value' => $entry->new_value,
                'user' => $entry->user ? [
                    'id' => $entry->user->id, 'name' => $entry->user->name,
                    'username' => $entry->user->username,
                ] : null,
                'project' => $entry->project ? [
                    'id' => $entry->project->id, 'code' => $entry->project->code,
                    'name' => $entry->project->name,
                ] : null,
            ])->values(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
        ])->header('Cache-Control', 'no-store');
    }
}
