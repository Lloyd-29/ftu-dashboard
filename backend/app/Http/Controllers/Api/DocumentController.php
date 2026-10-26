<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\DocumentRevision;
use App\Models\Project;
use App\Models\Task;
use App\Support\DocumentTypes;
use App\Support\TeamActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Document::class);
        $query = Document::query()->with(['project:id,code,name', 'revisions.uploader:id,name,engineer_id', 'revisions.reviewer:id,name']);
        if ($request->user()->role === 'engineer') {
            $query->where(fn ($q) => $q
                ->whereHas('project.engineers', fn ($e) => $e->where('engineers.id', $request->user()->engineer_id ?? 0))
                ->orWhereHas('revisions', fn ($r) => $r->where('uploaded_by', $request->user()->id)));
        }
        $filters = $request->validate(['project_id' => ['sometimes', 'integer', 'exists:projects,id'], 'status' => ['sometimes', 'in:submitted,revision_needed,checked']]);
        if (isset($filters['project_id'])) $query->where('project_id', $filters['project_id']);
        if (isset($filters['status'])) $query->whereHas('revisions', fn ($r) => $r->where('status', $filters['status']));
        $documents = $query->orderByDesc('updated_at')->orderByDesc('id')->get();
        return response()->json([
            'documents' => $documents->map(fn (Document $document) => $this->present($document, $request))->values(),
            'types' => DocumentTypes::all(),
            'pending_review_count' => $this->pendingCount($request),
        ])->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, Document $document): JsonResponse
    {
        Gate::authorize('view', $document);
        $document->load(['project:id,code,name', 'revisions.uploader:id,name,engineer_id', 'revisions.reviewer:id,name']);
        return response()->json(['document' => $this->present($document, $request)])->header('Cache-Control', 'no-store');
    }

    public function types(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Document::class);
        return response()->json(['types' => DocumentTypes::all()]);
    }

    public function updateTypes(Request $request): JsonResponse
    {
        abort_unless($request->user()->canManageProjects(), 403);
        $data = $request->validate([
            'types' => ['required', 'array', 'min:1', 'max:30'],
            'types.*' => ['required', 'string', 'min:1', 'max:100', 'distinct:ignore_case'],
        ]);
        $types = array_values(array_map('trim', $data['types']));
        if (count(array_unique(array_map('mb_strtolower', $types))) !== count($types) || in_array('', $types, true)) {
            throw ValidationException::withMessages(['types' => 'Nama jenis dokumen tidak boleh kosong atau duplikat.']);
        }
        DB::transaction(function () use ($request, $types): void {
            $previous = DocumentTypes::all();
            DocumentTypes::save($types);
            ActivityLog::query()->create([
                'user_id' => $request->user()->id, 'project_id' => null,
                'field' => 'document_types_updated',
                'old_value' => json_encode($previous, JSON_UNESCAPED_UNICODE),
                'new_value' => json_encode($types, JSON_UNESCAPED_UNICODE),
            ]);
        });
        return response()->json(['types' => $types]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Document::class);
        $data = $request->validate([
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'task_id' => ['nullable', 'integer', 'exists:tasks,id'],
            'doc_no' => ['required', 'string', 'max:100', 'regex:/^FTU-\d{4}\/R\.[A-Z0-9]{2,12}-[A-Z0-9-]{2,30}\/(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\/\d{4}$/', 'unique:documents,doc_no'],
            'title' => ['required', 'string', 'max:255'],
            'doc_type' => ['required', 'string', 'max:100', Rule::in(DocumentTypes::all())],
            'client_name' => ['required', 'string', 'max:255'],
            'revision_label' => ['required', 'regex:/^(?:[A-Z]|0|[1-9]\d{0,5})$/'],
            'description' => ['required', 'string', 'max:10000'],
            'issued_date' => ['required', 'date_format:Y-m-d'],
            'file' => ['required', 'file', 'max:15360'],
        ]);
        $project = Project::query()->findOrFail($data['project_id']);
        abort_unless($project->is_active, 422, 'Proyek tidak aktif.');
        $this->assertProjectAssignment($request, $project);
        if (! empty($data['task_id'])) $this->assertTask($request, $data['task_id'], $project->id);
        $this->validatePdf($request);
        $storedPath = null;
        try {
            $document = DB::transaction(function () use ($data, $request, &$storedPath): Document {
                $document = Document::query()->create([
                    'project_id' => $data['project_id'], 'task_id' => $data['task_id'] ?? null,
                    'doc_no' => $data['doc_no'], 'title' => $data['title'],
                    'doc_type' => $data['doc_type'], 'client_name' => $data['client_name'],
                ]);
                $storedPath = $this->storePdf($request, $document->id);
                $document->revisions()->create($this->revisionPayload($request, $data, $storedPath));
                TeamActivity::record($request->user()->id, $document->project_id, 'document_uploaded', null,
                    ['document_id' => $document->id, 'doc_no' => $document->doc_no, 'revision' => $data['revision_label']]);
                return $document;
            }, 3);
        } catch (\Throwable $error) {
            if ($storedPath) Storage::disk('local')->delete($storedPath);
            throw $error;
        }
        return response()->json(['document' => $this->present($document->load(['project:id,code,name', 'revisions.uploader:id,name,engineer_id', 'revisions.reviewer:id,name']), $request)], 201);
    }

    public function addRevision(Request $request, Document $document): JsonResponse
    {
        Gate::authorize('upload', $document);
        $data = $request->validate([
            'revision_label' => ['required', 'regex:/^(?:[A-Z]|0|[1-9]\d{0,5})$/'],
            'description' => ['required', 'string', 'max:10000'],
            'issued_date' => ['required', 'date_format:Y-m-d'],
            'file' => ['required', 'file', 'max:15360'],
        ]);
        abort_unless($document->project->is_active, 422, 'Proyek tidak aktif.');
        $this->validatePdf($request);
        $storedPath = null;
        try {
            $document = DB::transaction(function () use ($request, $document, $data, &$storedPath): Document {
                $locked = Document::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
                $latest = $locked->revisions()->orderByDesc('id')->first();
                if ($latest?->status === 'submitted') {
                    throw ValidationException::withMessages(['revision_label' => 'Revisi terakhir masih menunggu review.']);
                }
                if ($locked->revisions()->where('revision_label', $data['revision_label'])->exists()) {
                    throw ValidationException::withMessages(['revision_label' => 'Label revisi sudah digunakan.']);
                }
                if ($latest && ! $this->isNextRevision($latest->revision_label, $data['revision_label'])) {
                    throw ValidationException::withMessages(['revision_label' => 'Gunakan revisi berikutnya (huruf A–Z atau angka 0, 1, 2...).']);
                }
                $storedPath = $this->storePdf($request, $locked->id);
                $locked->revisions()->create($this->revisionPayload($request, $data, $storedPath));
                $locked->touch();
                TeamActivity::record($request->user()->id, $locked->project_id, 'document_revision_uploaded', null,
                    ['document_id' => $locked->id, 'revision' => $data['revision_label']]);
                return $locked;
            }, 3);
        } catch (\Throwable $error) {
            if ($storedPath) Storage::disk('local')->delete($storedPath);
            throw $error;
        }
        return response()->json(['document' => $this->present($document->load(['project:id,code,name', 'revisions.uploader:id,name,engineer_id', 'revisions.reviewer:id,name']), $request)], 201);
    }

    public function review(Request $request, DocumentRevision $revision): JsonResponse
    {
        Gate::authorize('review', $revision);
        $data = $request->validate([
            'decision' => ['required', 'in:checked,revision_needed'],
            'review_note' => [Rule::requiredIf(fn () => $request->input('decision') === 'revision_needed'), 'nullable', 'string', 'max:10000'],
        ]);
        $revision = DB::transaction(function () use ($request, $revision, $data): DocumentRevision {
            $locked = DocumentRevision::query()->whereKey($revision->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'submitted') {
                throw ValidationException::withMessages(['decision' => 'Revisi sudah direview; tidak dapat diubah.']);
            }
            if ($locked->document->revisions()->where('id', '>', $locked->id)->exists()) {
                throw ValidationException::withMessages(['decision' => 'Hanya revisi terbaru yang bisa direview.']);
            }
            $locked->status = $data['decision'];
            $locked->review_note = $data['review_note'] ?? null;
            $locked->reviewed_by = $request->user()->id;
            $locked->reviewed_at = now();
            $locked->save();
            $locked->document->touch();
            TeamActivity::record($request->user()->id, $locked->document->project_id, 'document_review',
                ['revision_id' => $locked->id, 'status' => 'submitted'],
                ['revision_id' => $locked->id, 'status' => $locked->status, 'note' => $locked->review_note]);
            return $locked;
        }, 3);
        return response()->json(['revision' => $this->presentRevision($revision->load(['uploader:id,name,engineer_id', 'reviewer:id,name']))]);
    }

    public function download(DocumentRevision $revision): BinaryFileResponse
    {
        Gate::authorize('view', $revision);
        $path = Storage::disk('local')->path($revision->stored_file_path);
        abort_unless(Storage::disk('local')->exists($revision->stored_file_path), 404, 'Berkas tidak ditemukan.');
        return response()->file($path, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="document.pdf"',
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroyRevision(Request $request, DocumentRevision $revision): JsonResponse
    {
        Gate::authorize('delete', $revision);
        $path = $revision->stored_file_path;
        DB::transaction(function () use ($request, $revision): void {
            $locked = DocumentRevision::query()->whereKey($revision->id)->lockForUpdate()->firstOrFail();
            $document = $locked->document;
            $lastRevision = $document->revisions()->count() === 1;
            $locked->delete();
            if ($lastRevision) $document->delete();
            else $document->touch();
            TeamActivity::record($request->user()->id, $document->project_id, 'document_revision_deleted',
                ['document_id' => $document->id, 'revision_id' => $locked->id,
                    'label' => $locked->revision_label, 'document_deleted' => $lastRevision], null);
        }, 3);
        Storage::disk('local')->delete($path);
        return response()->json(['message' => 'Revisi dihapus.']);
    }

    private function pendingCount(Request $request): int
    {
        return $request->user()->canManageProjects()
            ? DocumentRevision::query()->where('status', 'submitted')->count() : 0;
    }

    private function assertProjectAssignment(Request $request, Project $project): void
    {
        if ($request->user()->canManageProjects()) return;
        abort_unless($request->user()->role === 'engineer' && $request->user()->engineer_id !== null
            && $project->engineers()->whereKey($request->user()->engineer_id)->exists(), 403);
    }

    private function assertTask(Request $request, int $taskId, int $projectId): void
    {
        $task = Task::query()->findOrFail($taskId);
        if ($task->project_id !== $projectId) throw ValidationException::withMessages(['task_id' => 'Tugas tidak berada pada proyek yang dipilih.']);
        if ($request->user()->role === 'engineer' && $task->assignee_engineer_id !== $request->user()->engineer_id) {
            abort(403);
        }
    }

    private function validatePdf(Request $request): void
    {
        $file = $request->file('file');
        if (! $file || ! $file->isValid() || $file->getSize() > 15 * 1024 * 1024) {
            throw ValidationException::withMessages(['file' => 'Berkas PDF tidak valid atau melebihi 15 MB.']);
        }
        $handle = fopen($file->getRealPath(), 'rb');
        $header = $handle ? fread($handle, 5) : '';
        if ($handle) fclose($handle);
        $detected = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        if ($header !== '%PDF-' || ! in_array($detected, ['application/pdf', 'application/x-pdf'], true)) {
            throw ValidationException::withMessages(['file' => 'Hanya berkas PDF asli yang diperbolehkan.']);
        }
    }

    private function storePdf(Request $request, int $documentId): string
    {
        $name = Str::uuid().'.pdf';
        $path = Storage::disk('local')->putFileAs('documents/'.$documentId, $request->file('file'), $name);
        if ($path === false) throw ValidationException::withMessages(['file' => 'Gagal menyimpan berkas privat.']);
        return $path;
    }

    private function revisionPayload(Request $request, array $data, string $path): array
    {
        return [
            'revision_label' => $data['revision_label'], 'description' => $data['description'],
            'issued_date' => $data['issued_date'], 'stored_file_path' => $path,
            'original_file_name' => basename($request->file('file')->getClientOriginalName()),
            'mime_type' => 'application/pdf', 'file_size' => $request->file('file')->getSize(),
            'uploaded_by' => $request->user()->id, 'status' => 'submitted',
        ];
    }

    private function isNextRevision(string $previous, string $next): bool
    {
        if (preg_match('/^[A-Z]$/', $previous)) {
            return $previous === 'Z' ? $next === '0' : $next === chr(ord($previous) + 1) || $next === '0';
        }
        return ctype_digit($next) && (int) $next === (int) $previous + 1;
    }

    private function present(Document $document, Request $request): array
    {
        $assigned = $request->user()->role !== 'engineer' || ($request->user()->engineer_id !== null
            && $document->project->engineers()->whereKey($request->user()->engineer_id)->exists());
        $revisions = $document->revisions->filter(fn (DocumentRevision $r) => $assigned || (int) $r->uploaded_by === (int) $request->user()->id)
            ->sortBy('id')->values();
        return [
            'id' => $document->id, 'project_id' => $document->project_id,
            'project_code' => $document->project?->code, 'project_name' => $document->project?->name,
            'task_id' => $document->task_id, 'doc_no' => $document->doc_no,
            'title' => $document->title, 'doc_type' => $document->doc_type,
            'client_name' => $document->client_name,
            'revisions' => $revisions->map(fn (DocumentRevision $r) => $this->presentRevision($r))->all(),
            'updated_at' => $document->updated_at?->toIso8601String(),
        ];
    }

    private function initials(?string $name): ?string
    {
        if (! $name) return null;
        $parts = preg_split('/\s+/', trim($name));
        if (! $parts) return null;
        return mb_strtoupper(count($parts) > 1
            ? implode('', array_map(fn (string $part): string => mb_substr($part, 0, 1), $parts))
            : mb_substr($name, 0, 3));
    }

    private function presentRevision(DocumentRevision $r): array
    {
        $engineer = $r->uploader?->engineer_id ? \App\Models\Engineer::query()->find($r->uploader->engineer_id) : null;
        return [
            'id' => $r->id, 'revision_label' => $r->revision_label,
            'issue_purpose' => ctype_digit($r->revision_label) ? 'approval' : 'review',
            'description' => $r->description, 'issued_date' => $r->issued_date->toDateString(),
            'original_file_name' => $r->original_file_name, 'file_size' => $r->file_size,
            'status' => $r->status, 'review_note' => $r->review_note,
            'uploaded_by_name' => $r->uploader?->name, 'prepared_initials' => $engineer?->initials,
            'reviewed_by_name' => $r->reviewer?->name,
            'checked_initials' => $r->reviewer?->engineer?->initials ?: $this->initials($r->reviewer?->name),
            'reviewed_at' => $r->reviewed_at?->toIso8601String(),
            'download_url' => '/api/document-revisions/'.$r->id.'/download',
        ];
    }
}
