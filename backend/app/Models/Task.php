<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Task extends Model
{
    protected $fillable = ['project_id', 'assignee_engineer_id', 'title', 'description', 'type', 'due_date', 'status', 'created_by'];

    protected function casts(): array
    {
        return ['due_date' => 'date'];
    }

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function assignee(): BelongsTo { return $this->belongsTo(Engineer::class, 'assignee_engineer_id'); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function verification(): HasOne { return $this->hasOne(FieldVerification::class); }
}
