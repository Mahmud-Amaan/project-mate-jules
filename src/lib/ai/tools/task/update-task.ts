/**
 * Update Task Tool
 * This file implements a tool for updating tasks in a project
 * following the single responsibility principle
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { updateTaskCore, TaskServiceUpdateData } from "@/lib/tasks"; // Updated import

/**
 * Update a task
 * @param taskId - The ID of the task
 * @param updates - The updates to apply
 * @returns The updated task
 */
export async function updateTask(
  taskId: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    due_date?: Date | null;
    techIcons?: string[];
  }
) {
  // Ensure the 'updates' object matches TaskServiceUpdateData expected by updateTaskCore
  return updateTaskCore(taskId, updates as TaskServiceUpdateData);
}

/**
 * Create a tool for updating a task
 * @param projectId - The ID of the project
 * @returns A tool for updating a task
 */
export function updateTaskTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "update_task",
    description: "Update an existing task. Use this when the user asks to change, edit, modify, or update a task. Requires taskId parameter. Example: 'Update the login task description'. Tech icons can be updated or will be automatically suggested based on task content.",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to update (required, must be a valid task ID like '123e4567-e89b-12d3-a456-426614174000')"),
      title: z.string().optional().describe("The new title of the task (optional)"),
      description: z.string().optional().describe("The new description of the task (optional)"),
      status: z.string().optional().describe("The new status key of the task (optional, must be an uppercase key like 'BACKLOG', not a column name)"),
      priority: z.string().optional().describe("The new priority of the task (optional, one of: 'LOW', 'MEDIUM', 'HIGH', 'URGENT')"),
      techIcons: z.array(z.string()).optional().describe("The tech icons for the task (optional, array of icon slugs from simple-icons). If not provided but title/description is updated, icons will be automatically suggested."),
    }),
    func: async ({ taskId, title, description, status, priority, techIcons }) => {
      try {
        console.log(`Updating task ${taskId} in project ${projectId}`);

        // Ensure at least one field is being updated
        if (!title && !description && !status && !priority && !techIcons) {
          return JSON.stringify({
            success: false,
            error: "At least one field (title, description, status, priority, or techIcons) must be provided for update",
          });
        }

        const updatePayload: TaskServiceUpdateData = {
          title,
          description,
          status,
          priority,
          techIcons
        };
        const task = await updateTaskCore(taskId, updatePayload);

        if (!task) {
          return JSON.stringify({
            success: false,
            error: "Failed to update task. Task may not exist or you may not have permission to update it.",
          });
        }

        // Parse tech icons from the task
        let assignedIcons: string[] = [];
        if (task.tech_icons) {
          try {
            assignedIcons = typeof task.tech_icons === 'string'
              ? JSON.parse(task.tech_icons)
              : task.tech_icons;
          } catch (e) {
            console.error("Error parsing tech icons:", e);
          }
        }

        // Create a message describing what was updated
        const updatedFields = [];
        if (title) updatedFields.push("title");
        if (description) updatedFields.push("description");
        if (status) updatedFields.push("status");
        if (priority) updatedFields.push("priority");
        if (techIcons || (assignedIcons.length > 0 && (title || description))) updatedFields.push("tech icons");

        const updateMessage = `Task updated successfully: ${updatedFields.join(", ")} ${updatedFields.length > 1 ? 'were' : 'was'} changed.`;

        const iconMessage = assignedIcons.length > 0
          ? ` Task now has tech icons: ${assignedIcons.join(', ')}`
          : '';

        return JSON.stringify({
          success: true,
          task,
          techIcons: assignedIcons,
          message: updateMessage + iconMessage,
        });
      } catch (error) {
        console.error("Error in update_task tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error updating task",
        });
      }
    },
  });
}
