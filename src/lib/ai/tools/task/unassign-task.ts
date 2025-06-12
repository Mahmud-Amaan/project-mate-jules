/**
 * Unassign Task Tool
 * This tool allows the AI to unassign tasks from project members
 */

import { db } from "@/db";
import { taskAssignees } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Unassign a task from a project member
 * @param taskId - The ID of the task
 * @param userId - The ID of the user to unassign (optional, if not provided, unassigns all users)
 * @returns Result of the unassignment operation
 */
export async function unassignTask(taskId: string, userId?: string) {
  try {
    if (!taskId) {
      throw new Error("Task ID is required");
    }

    let condition;

    if (userId) {
      // Unassign specific user
      condition = and(
        eq(taskAssignees.taskId, taskId),
        eq(taskAssignees.userId, userId)
      );
    } else {
      // Unassign all users
      condition = eq(taskAssignees.taskId, taskId);
    }

    // @ts-ignore // Drizzle type issue with dynamic conditions
    const result = await db.delete(taskAssignees).where(condition).returning();

    if (result.length === 0) {
      return {
        success: true,
        message: userId 
          ? "Task was not assigned to this user" 
          : "Task had no assignees",
        count: 0
      };
    }

    return {
      success: true,
      message: userId 
        ? "Task unassigned from user successfully" 
        : `Task unassigned from ${result.length} users successfully`,
      count: result.length
    };
  } catch (error) {
    console.error("Error unassigning task:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to unassign task"
    };
  }
}

/**
 * Create a tool for unassigning tasks
 * @param projectId - The ID of the project (not used directly but kept for consistency)
 * @returns The unassign task tool
 */
export function unassignTaskTool(projectId: string) {
  return {
    name: "unassign_task",
    description: "Unassign a task from a project member. If userId is not provided, unassigns all users from the task.",
    func: async (params: { taskId: string; userId?: string }) => {
      try {
        const result = await unassignTask(params.taskId, params.userId);
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
