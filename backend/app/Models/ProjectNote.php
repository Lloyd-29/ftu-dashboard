<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class ProjectNote extends Model
{
    use HasFactory;
    protected $fillable = ['project_id','note_date','body','created_by'];
    protected function casts(): array { return ['note_date'=>'date']; }
    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class,'created_by'); }
}
