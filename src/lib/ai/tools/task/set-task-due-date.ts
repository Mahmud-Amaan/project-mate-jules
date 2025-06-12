/**
 * Set Task Due Date Tool
 * This tool allows the AI to set or update the due date of a task
 */

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Set the due date of a task
 * @param taskId - The ID of the task
 * @param dueDate - The due date to set (ISO string or null to remove)
 * @returns Result of the operation
 */
export async function setTaskDueDate(taskId: string, dueDate: string | null) {
  try {
    if (!taskId) {
      throw new Error("Task ID is required");
    }

    // Validate the due date if provided
    let dueDateObj: Date | null = null;
    if (dueDate) {
      dueDateObj = new Date(dueDate);
      if (isNaN(dueDateObj.getTime())) {
        throw new Error("Invalid due date format. Please use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.sssZ)");
      }
    }

    // Update the task
    const [updatedTask] = await db.update(tasks)
      .set({
        due_date: dueDateObj
      })
      .where(eq(tasks.id, taskId))
      .returning();

    if (!updatedTask) {
      throw new Error("Task not found");
    }

    return {
      success: true,
      message: dueDate ? "Task due date set successfully" : "Task due date removed",
      task: updatedTask
    };
  } catch (error) {
    console.error("Error setting task due date:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to set task due date"
    };
  }
}

/**
 * Create a tool for setting task due dates
 * @param projectId - The ID of the project (not used directly but kept for consistency)
 * @returns The set task due date tool
 */
export function setTaskDueDateTool(projectId: string) {
  return {
    name: "set_task_due_date",
    description: "Set or update the due date of a task. Provide null or empty string to remove the due date.",
    func: async (params: { taskId: string; dueDate: string | null }) => {
      try {
        const result = await setTaskDueDate(params.taskId, params.dueDate);
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
