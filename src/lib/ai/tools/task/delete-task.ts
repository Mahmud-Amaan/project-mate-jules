/**
 * Delete Task Tool
 * This file implements a tool for deleting tasks in a project
 * following the single responsibility principle
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getProjectTasks as getProjectTasksBase } from "../../langchain/tools"; // deleteTaskBase removed
import { deleteTaskCore } from "@/lib/tasks"; // Added deleteTaskCore

/**
 * Delete a task
 * @param taskId - The ID of the task
 * @returns True if the task was deleted
 */
export async function deleteTask(taskId: string) {
  // Note: deleteTaskCore might take an optional userId if auth needs to be enforced here
  return deleteTaskCore(taskId);
}

/**
 * Create a tool for deleting a task
 * @param projectId - The ID of the project
 * @returns A tool for deleting a task
 */
export function deleteTaskTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "delete_task",
    description: "Delete a task from the project. Use this when the user asks to remove, delete, or get rid of a task. Requires taskId parameter. Example: 'Delete the login task'.",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to delete (required, must be a valid task ID like '123e4567-e89b-12d3-a456-426614174000')"),
    }),
    func: async ({ taskId }) => {
      try {
        console.log(`Deleting task ${taskId} in project ${projectId}`);

        // Get task details before deletion for better feedback
        const allTasks = await getProjectTasksBase(projectId);
        const taskToDelete = allTasks.find(task => task.id === taskId);

        if (!taskToDelete) {
          return JSON.stringify({
            success: false,
            error: "Task not found. Please check the task ID and try again.",
          });
        }

        const taskTitle = taskToDelete.title;
        const result = await deleteTaskCore(taskId); // Changed to deleteTaskCore

        if (!result) {
          return JSON.stringify({
            success: false,
            error: "Failed to delete task. You may not have permission to delete this task.",
          });
        }

        return JSON.stringify({
          success: true,
          message: `Task "${taskTitle}" (ID: ${taskId}) was successfully deleted.`,
        });
      } catch (error) {
        console.error("Error in delete_task tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error deleting task",
        });
      }
    },
  });
}
