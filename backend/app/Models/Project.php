<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'client',
        'is_active',
        'status',
        'progress_percent',
        'planned_progress_percent',
        'sop_phase',
        'next_milestone_name',
        'next_milestone_date',
        'risks',
        'findings_open',
        'findings_closed',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'progress_percent' => 'integer',
            'planned_progress_percent' => 'integer',
            'next_milestone_date' => 'date',
            'findings_open' => 'integer',
            'findings_closed' => 'integer',
            'version' => 'integer',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function engineers(): BelongsToMany
    {
        return $this->belongsToMany(Engineer::class, 'project_engineer')
            ->withPivot('allocation_percent')
            ->withTimestamps();
    }

    public function notes(): HasMany
    {
        return $this->hasMany(ProjectNote::class);
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(Milestone::class);
    }

    public function progressPoints(): HasMany
    {
        return $this->hasMany(ProgressPoint::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }
}