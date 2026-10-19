<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('progress_points', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->date('week_date');

            $table->unsignedTinyInteger('planned')->nullable();
            $table->unsignedTinyInteger('actual')->nullable();

            $table->timestamps();

            $table->unique(['project_id', 'week_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('progress_points');
    }
};