<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->restrictOnDelete();
            $table->foreignId('assignee_engineer_id')->constrained('engineers')->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('type', 24)->default('job');
            $table->date('due_date');
            $table->string('status', 16)->default('todo');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['assignee_engineer_id', 'status', 'due_date']);
            $table->index(['project_id', 'status', 'due_date']);
        });

        Schema::create('field_verifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('task_id')->unique()->constrained('tasks')->restrictOnDelete();
            $table->string('site_name');
            $table->date('visit_date');
            $table->string('result', 16)->default('pending');
            $table->unsignedInteger('findings_count')->default(0);
            $table->text('notes')->nullable();
            $table->string('review_status', 24)->default('pending');
            $table->text('review_note')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->unsignedInteger('applied_findings_count')->default(0);
            $table->timestamps();
            $table->index(['review_status', 'visit_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('field_verifications');
        Schema::dropIfExists('tasks');
    }
};
