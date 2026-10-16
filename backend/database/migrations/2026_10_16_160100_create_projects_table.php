<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table): void {
            $table->id();

            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('client');

            $table->boolean('is_active')->default(true);
            $table->string('status', 16);

            $table->unsignedTinyInteger('progress_percent')->nullable();
            $table->unsignedTinyInteger('planned_progress_percent')->nullable();

            $table->string('sop_phase')->nullable();

            $table->string('next_milestone_name')->nullable();
            $table->date('next_milestone_date')->nullable();

            $table->text('risks')->nullable();

            $table->unsignedInteger('findings_open')->default(0);
            $table->unsignedInteger('findings_closed')->default(0);

            $table->unsignedInteger('version')->default(1);

            $table->foreignId('updated_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['is_active', 'status']);
            $table->index('next_milestone_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};