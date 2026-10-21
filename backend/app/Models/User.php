<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
    protected $fillable = ['name','username','email','password','role','engineer_id','is_active','must_change_password'];
    protected $hidden = ['password','remember_token'];
    protected function casts(): array { return ['email_verified_at'=>'datetime','password'=>'hashed','is_active'=>'boolean','must_change_password'=>'boolean']; }
    public function engineer(): BelongsTo { return $this->belongsTo(Engineer::class); }
    public function updatedProjects(): HasMany { return $this->hasMany(Project::class, 'updated_by'); }
    public function activityLogs(): HasMany { return $this->hasMany(ActivityLog::class); }
    public function canManageProjects(): bool { return $this->is_active && in_array($this->role,['admin','coordinator','director'],true); }
}
