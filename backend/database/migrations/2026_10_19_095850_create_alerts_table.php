<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table): void {
            $table->id();

            $table->string('title');
            $table->string('severity', 16);

            $table->foreignId('project_id')
                ->nullable()
                ->constrained('projects')
                ->nullOnDelete();

            $table->date('due_date')->nullable();
            $table->boolean('is_resolved')->default(false);

            $table->timestamps();

            $table->index(['is_resolved', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};