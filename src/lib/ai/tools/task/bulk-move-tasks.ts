/**
 * Bulk Move Tasks Tool
 * This tool allows the AI to move multiple tasks to a different status/column at once
 */

import { db } from "@/db";
import { tasks, projectTaskStatuses } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Move multiple tasks to a different status/column
 * @param projectId - The ID of the project
 * @param taskIds - Array of task IDs to move
 * @param targetStatus - The target status key
 * @returns Result of the move operation
 */
export async function bulkMoveTasks(projectId: string, taskIds: string[], targetStatus: string) {
  try {
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new Error("Task IDs are required and must not be empty");
    }

    if (!targetStatus) {
      throw new Error("Target status is required");
    }

    // Verify the target status exists
    const [statusExists] = await db.select()
      .from(projectTaskStatuses)
      .where(
        and(
          eq(projectTaskStatuses.project_id, projectId),
          eq(projectTaskStatuses.key, targetStatus)
        )
      );

    if (!statusExists) {
      throw new Error(`Target status '${targetStatus}' does not exist in this project`);
    }

    // Verify all tasks belong to the project
    const existingTasks = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.project_id, projectId),
          inArray(tasks.id, taskIds)
        )
      );

    // Check if all tasks exist and belong to the project
    const foundTaskIds = existingTasks.map(task => task.id);
    const missingTaskIds = taskIds.filter(id => !foundTaskIds.includes(id));

    if (missingTaskIds.length > 0) {
      throw new Error(`Some tasks were not found or don't belong to this project: ${missingTaskIds.join(', ')}`);
    }

    // Update all tasks at once
    const updatedTasks = await db.update(tasks)
      .set({
        status: targetStatus as "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE",
        status_key: targetStatus
      })
      .where(
        and(
          eq(tasks.project_id, projectId),
          inArray(tasks.id, taskIds)
        )
      )
      .returning();

    return {
      success: true,
      tasks: updatedTasks,
      message: `Moved ${updatedTasks.length} tasks to ${statusExists.name} (${targetStatus})`
    };
  } catch (error) {
    console.error("Error moving tasks in bulk:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to move tasks"
    };
  }
}

/**
 * Create a tool for bulk moving tasks
 * @param projectId - The ID of the project
 * @returns The bulk move tasks tool
 */
export function bulkMoveTasksTool(projectId: string) {
  return {
    name: "bulk_move_tasks",
    description: "Move multiple tasks to a different status/column at once. Useful for updating the status of related tasks.",
    func: async (params: { taskIds: string[]; targetStatus: string }) => {
      try {
        const result = await bulkMoveTasks(projectId, params.taskIds, params.targetStatus);
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
