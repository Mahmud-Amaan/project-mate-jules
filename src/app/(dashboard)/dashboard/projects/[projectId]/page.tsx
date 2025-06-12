import { Suspense } from "react";
import { getProjectTasks } from "@/lib/tasks";
import TrelloBoard from "@/components/kanban/TrelloBoard";
import ProjectSkeleton from "@/components/dashboard/ProjectSkeleton";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import ProjectPageWrapper from "@/components/dashboard/project-page-wrapper";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // Get the current user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log('Project Page: No authenticated user found');
    return (
      <div className="flex items-center justify-center h-full">
        <p>Please log in to view this project</p>
      </div>
    );
  }

  console.log(`Project Page: Loading project ${projectId} for user ${user.id}`);

  try {
    // Get the project details
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      console.log(`Project Page: Project ${projectId} not found`);
      return (
        <div className="flex items-center justify-center h-full">
          <p>Project not found</p>
        </div>
      );
    }

    // Check if current user is the project owner
    const isOwner = project.ownerId === user.id;
    console.log(`Project Page: User is owner: ${isOwner}`);

    // Get initial tasks (with a timeout to prevent blocking)
    let initialTasks = [];
    try {
      // Set a timeout for task fetching to prevent blocking the page load
      const taskPromise = getProjectTasks(projectId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task fetch timeout')), 2000)
      );

      initialTasks = await Promise.race([taskPromise, timeoutPromise]) as any[];
    } catch (error) {
      console.log(`Project Page: Error or timeout fetching tasks: ${error}`);
      // Continue with empty tasks, they'll be loaded client-side
    }

    return (
      <ProjectPageWrapper project={project}>
        <Suspense fallback={<ProjectSkeleton />}>
          <TrelloBoard
            projectId={projectId}
            initialTasks={initialTasks}
            isOwner={isOwner}
            projectName={project.name}
          />
        </Suspense>
      </ProjectPageWrapper>
    );
  } catch (error) {
    console.error(`Project Page: Error loading project: ${error}`);
    return (
      <div className="flex items-center justify-center h-full">
        <p>Error loading project. Please try refreshing the page.</p>
      </div>
    );
  }
}


