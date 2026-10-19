<?php

namespace Tests\Feature;

use App\Models\Engineer;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Tests\TestCase;

class CoreModelRelationshipsTest extends TestCase
{
    public function test_project_has_user_and_engineer_relationships(): void
    {
        $project = new Project();

        $this->assertInstanceOf(BelongsTo::class, $project->updatedBy());
        $this->assertInstanceOf(BelongsToMany::class, $project->engineers());
    }

    public function test_engineer_has_projects_relationship(): void
    {
        $this->assertInstanceOf(
            BelongsToMany::class,
            (new Engineer())->projects()
        );
    }

    public function test_user_tracks_projects_they_last_updated(): void
    {
        $this->assertInstanceOf(
            HasMany::class,
            (new User())->updatedProjects()
        );
    }

    public function test_unreported_progress_remains_null(): void
    {
        $project = new Project();

        $this->assertNull($project->progress_percent);
        $this->assertNull($project->planned_progress_percent);
    }
}