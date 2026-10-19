<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('milestones', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->string('name');
            $table->date('due_date');

            $table->boolean('is_completed')->default(false);

            $table->timestamps();

            $table->index(['project_id', 'due_date']);
            $table->index(['is_completed', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('milestones');
    }
};