"use server";

import { db } from "@/db";
import { projects, tasks, projectMembers, authUsers as users } from "@/db/schema";
import { eq } from "drizzle-orm";
// Note: We might need createClient if we add auth checks later, but for now, it's not used.
// import { createClient } from "@/utils/supabase/server";

// Define types for the return structure if not already available globally
// These are illustrative; you might have these in a central types file.
type ProjectTask = typeof tasks.$inferSelect;
type ProjectMember = {
  id?: string;
  name: string;
  email?: string;
  role: "OWNER" | "MANAGER" | "MEMBER"; // Assuming userRoleEnum values
};
type ProjectInfo = {
  project: typeof projects.$inferSelect | { name: string; description: string };
  tasks: Partial<ProjectTask>[]; // Allow partial task data if some fields are omitted
  members: ProjectMember[];
};


export async function getProjectInfoCore(projectId: string): Promise<ProjectInfo> {
  try {
    if (!projectId) {
      console.error("Project ID is required for getProjectInfoCore");
      // Return a structure indicating error or missing info, matching original behavior
      return {
        project: { name: "Unknown Project", description: "Project ID not provided" },
        tasks: [],
        members: [],
      };
    }

    const projectResult = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    const project = projectResult[0];

    if (!project) {
      console.warn(`Project not found with ID: ${projectId} in getProjectInfoCore`);
      return {
        project: { name: "Unknown Project", description: `Project not found with ID: ${projectId}` },
        tasks: [],
        members: [],
      };
    }

    let projectTasksData: Partial<ProjectTask>[] = [];
    try {
      projectTasksData = await db
        .select({ // Select specific fields if not all are needed by the AI tool
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          status_key: tasks.status_key,
          priority: tasks.priority,
          due_date: tasks.due_date,
          // description: tasks.description, // Add if needed by the tool
        })
        .from(tasks)
        .where(eq(tasks.project_id, projectId));
    } catch (taskError) {
      console.error(`Error fetching tasks for project ${projectId} in getProjectInfoCore:`, taskError);
      // Continue with empty tasks array
    }

    let membersData: ProjectMember[] = [];
    try {
      const memberResults = await db
        .select({
          userId: users.id,
          userMetadata: users.metadata, // This is UserMetadata type from schema.ts
          role: projectMembers.role,
        })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId))
        .innerJoin(users, eq(users.id, projectMembers.userId));

      membersData = memberResults.map(m => {
        // UserMetadata is already typed correctly by Drizzle via $type<UserMetadata>()
        const metadata = m.userMetadata || {};
        return {
          id: m.userId,
          name: metadata.full_name || metadata.email?.split('@')[0] || 'Unknown User',
          email: metadata.email,
          role: m.role, // role is directly from projectMembers and should be correctly typed
        };
      });
    } catch (memberError) {
      console.error(`Error fetching members for project ${projectId} in getProjectInfoCore:`, memberError);
      // Continue with empty members array
    }

    return {
      project,
      tasks: projectTasksData,
      members: membersData,
    };
  } catch (error) {
    console.error(`Failed to get project info for ${projectId} in getProjectInfoCore:`, error);
    return {
      project: { name: "Unknown Project", description: "Error retrieving project information" },
      tasks: [],
      members: [],
    };
  }
}
