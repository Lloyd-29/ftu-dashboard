<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
class Engineer extends Model
{
    use HasFactory;
    protected $fillable = ['name','is_active','initials'];
    protected function casts(): array { return ['is_active'=>'boolean']; }
    public function user(): HasOne { return $this->hasOne(User::class); }
    public function projects(): BelongsToMany { return $this->belongsToMany(Project::class,'project_engineer')->withPivot('allocation_percent')->withTimestamps(); }
}
