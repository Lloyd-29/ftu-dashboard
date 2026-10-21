<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FieldVerification extends Model
{
    protected $fillable = [
        'task_id', 'site_name', 'visit_date', 'result', 'findings_count', 'notes',
        'review_status', 'review_note', 'submitted_at', 'verified_by', 'verified_at',
        'applied_findings_count',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date', 'findings_count' => 'integer',
            'submitted_at' => 'datetime', 'verified_at' => 'datetime',
            'applied_findings_count' => 'integer',
        ];
    }

    public function task(): BelongsTo { return $this->belongsTo(Task::class); }
    public function verifier(): BelongsTo { return $this->belongsTo(User::class, 'verified_by'); }
}
