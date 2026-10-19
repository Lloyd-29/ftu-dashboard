<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgressPoint extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'week_date',
        'planned',
        'actual',
    ];

    protected function casts(): array
    {
        return [
            'week_date' => 'date',
            'planned' => 'integer',
            'actual' => 'integer',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}