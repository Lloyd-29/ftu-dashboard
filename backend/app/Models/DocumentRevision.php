<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentRevision extends Model
{
    protected $fillable = [
        'revision_label', 'description', 'issued_date', 'stored_file_path',
        'original_file_name', 'mime_type', 'file_size', 'uploaded_by',
        'status', 'reviewed_by', 'reviewed_at', 'review_note',
    ];

    protected function casts(): array
    {
        return ['issued_date' => 'date', 'reviewed_at' => 'datetime', 'file_size' => 'integer'];
    }

    public function document(): BelongsTo { return $this->belongsTo(Document::class); }
    public function uploader(): BelongsTo { return $this->belongsTo(User::class, 'uploaded_by'); }
    public function reviewer(): BelongsTo { return $this->belongsTo(User::class, 'reviewed_by'); }
}
