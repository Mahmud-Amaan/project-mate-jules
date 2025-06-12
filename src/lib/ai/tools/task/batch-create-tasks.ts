/**
 * Batch Create Tasks Tool
 * This tool allows the AI to create multiple tasks at once
 */

// @ts-ignore - Path aliases not recognized in isolated TypeScript checks
import { db } from "@/db";
// @ts-ignore - Path aliases not recognized in isolated TypeScript checks
import { tasks } from "@/db/schema";
import { suggestTechIcons } from "./tech-icon-matcher";

/**
 * Create multiple tasks in a batch
 * @param projectId - The ID of the project
 * @param taskList - Array of task data
 * @returns The created tasks
 */
export async function batchCreateTasks(projectId: string, taskList: Array<{
  title: string;
  description?: string;
  status?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}>) {
  try {
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    if (!Array.isArray(taskList) || taskList.length === 0) {
      throw new Error("Task list is required and must not be empty");
    }

    console.log("Batch creating tasks:", taskList);

    // Get the current user ID from Supabase if possible
    let userId = "00000000-0000-0000-0000-000000000000"; // Default system user ID

    try {
      // Import createClient dynamically to avoid circular dependencies
      const { createClient } = await import("@/utils/supabase/server");
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.id) {
        userId = user.id;
        console.log("Using authenticated user ID for batch task creation:", userId);
      }
    } catch (authError) {
      console.warn("Could not get authenticated user, using system user ID:", authError);
    }

    // Prepare task values with tech icons
    const taskValues = taskList.map(taskData => {
      // Generate tech icons based on title and description
      const techIcons = suggestTechIcons(
        taskData.title,
        taskData.description || ""
      );

      // Ensure status is properly set
      const status = taskData.status || "BACKLOG";
      // Convert to uppercase and replace spaces with underscores for status_key
      const status_key = status.toUpperCase().replace(/\s+/g, '_');

      return {
        title: taskData.title,
        description: taskData.description || "",
        status: status as "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE",
        status_key: status_key,
        priority: taskData.priority || "MEDIUM",
        project_id: projectId,
        created_by: userId,
        tech_icons: JSON.stringify(techIcons),
        tech_icon: techIcons.length > 0 ? techIcons[0] : null,
      };
    });

    // Insert all tasks in a batch
    const createdTasks = await db.insert(tasks).values(taskValues).returning();

    return {
      success: true,
      tasks: createdTasks,
      message: `Created ${createdTasks.length} tasks successfully.`
    };
  } catch (error) {
    console.error("Error creating tasks in batch:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to create tasks."
    };
  }
}

/**
 * Create a tool for batch creating tasks
 * @param projectId - The ID of the project
 * @returns The batch create tasks tool
 */
export function batchCreateTasksTool(projectId: string) {
  return {
    name: "batch_create_tasks",
    description: "Create multiple tasks at once. Useful for creating a set of related tasks or initializing a project with multiple tasks.",
    func: async (params: { tasks: Array<{
      title: string;
      description?: string;
      status?: string;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    }> }) => {
      try {
        const result = await batchCreateTasks(projectId, params.tasks);
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  };
}
