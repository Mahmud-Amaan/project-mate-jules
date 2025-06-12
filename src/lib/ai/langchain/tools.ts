/**
 * LangChain Tools System
 * This file implements proper LangChain tools
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
// Imports for db, schemas, drizzle utils, createClient are removed as they are no longer directly used.
import {
  fetchProjectTasksCore,
  createTaskCore,
  updateTaskCore,
  TaskServiceUpdateData,
  deleteTaskCore,
  getTaskStatusesCore,
  createTaskStatusCore,
  updateTaskStatusCore,
  TaskStatusUpdatePayload,
  // deleteTaskStatusCore, // Duplicate removed
  moveTaskCore
} from "@/lib/tasks";
import { getProjectInfoCore } from "@/lib/projects";

/**
 * Get project information
 * @param projectId - The ID of the project
 * @returns Project information
 */
// export async function getProjectInfo(projectId: string) { ... } // Original function moved to src/lib/projects.ts as getProjectInfoCore

/**
 * Get task statuses for a project
 * @param projectId - The ID of the project
 * @returns The task statuses
 */
export async function getTaskStatuses(projectId: string) {
  // This function now acts as a wrapper around the core logic
  // to maintain the existing signature and error handling for consumers
  // within this file or other AI tool files that might import it directly.
  // getTaskStatusesCore is designed to handle its own errors and return []
  return await getTaskStatusesCore(projectId);
}

/**
 * Create a new task
 * @param projectId - The ID of the project
 * @param title - The title of the task
 * @param description - The description of the task
 * @param status - The status of the task
 * @param priority - The priority of the task
 * @param techIcons - The tech icons for the task (optional)
 * @returns The created task
 */
// export async function createTask(...) // Original function moved to src/lib/tasks.ts as createTaskCore

/**
 * Update a task
 * @param taskId - The ID of the task
 * @param updates - The updates to apply
 * @returns The updated task
 */
// export async function updateTask(...) // Original function moved to src/lib/tasks.ts as updateTaskCore

/**
 * Delete a task
 * @param taskId - The ID of the task
 * @returns True if the task was deleted
 */
// export async function deleteTask(taskId: string) { ... } // Original function moved to src/lib/tasks.ts as deleteTaskCore

/**
 * Get all tasks for a project
 * @param projectId - The ID of the project
 * @returns The tasks
 */
export async function getProjectTasks(projectId: string) {
  try {
    if (!projectId) {
      console.error("Project ID is required");
      return [];
    }

    // Get all tasks for the project using the core function
    // No specific sorting needed for this version
    const projectTasks = await fetchProjectTasksCore(projectId);
    return projectTasks; // fetchProjectTasksCore throws, so this will only be reached on success.
  } catch (error) {
    // The public function still returns [] on error as per its original contract
    console.error("Error in getProjectTasks (langchain/tools):", error);
    return [];
  }
}

/**
 * Create a new task status (column)
 * @param projectId - The ID of the project
 * @param name - The name of the status
 * @param color - The color of the status
 * @returns The created status
 */
export async function createTaskStatus(
  projectId: string,
  name: string,
  color?: string
) {
  // Wrapper for createTaskStatusCore
  // The core function handles auth and detailed logic.
  // This wrapper maintains the original function's error handling (return null on error).
  try {
    // Assuming createTaskStatusCore requires userId for auth,
    // but the original tool function didn't explicitly pass it.
    // createTaskStatusCore in tasks.ts is designed to fetch user if not provided.
    return await createTaskStatusCore({ projectId, name, color });
  } catch (error) {
    console.error("Error in langchain/tools wrapper for createTaskStatus:", error);
    return null;
  }
}

/**
 * Update a task status (column)
 * @param statusId - The ID of the status to update
 * @param projectId - The ID of the project
 * @param updates - The updates to apply
 * @returns The updated status
 */
export async function updateTaskStatus(
  statusId: string,
  projectId: string,
  updates: { // This is TaskStatusUpdatePayload from tasks.ts if we map `position` to `order`
    name?: string;
    color?: string;
    position?: number; // This will be mapped to 'order' for the core function
  }
) {
  // Wrapper for updateTaskStatusCore
  // The core function handles auth and detailed logic.
  // This wrapper maintains the original function's error handling (return null on error).
  try {
    const coreUpdates: TaskStatusUpdatePayload = {
      name: updates.name,
      color: updates.color,
      order: updates.position, // Mapping position to order
    };
    // Assuming updateTaskStatusCore requires userId for auth,
    // but the original tool function didn't explicitly pass it.
    // updateTaskStatusCore in tasks.ts is designed to fetch user if not provided.
    return await updateTaskStatusCore(statusId, projectId, coreUpdates);
  } catch (error) {
    console.error("Error in langchain/tools wrapper for updateTaskStatus:", error);
    return null;
  }
}

/**
 * Delete a task status (column)
 * @param statusId - The ID of the status to delete
 * @param projectId - The ID of the project
 * @param moveTasksTo - The ID of the status to move tasks to
 * @returns True if the status was deleted
 */
export async function deleteTaskStatus(
  statusId: string,
  projectId: string,
  moveTasksTo?: string // This is moveTasksToStatusKey in the core function
) {
  // Wrapper for deleteTaskStatusCore
  try {
    // deleteTaskStatusCore is designed to fetch user if not provided.
    return await deleteTaskStatusCore(statusId, projectId, { moveTasksToStatusKey: moveTasksTo });
  } catch (error) {
    console.error("Error in langchain/tools wrapper for deleteTaskStatus:", error);
    return false; // Original function returned boolean
  }
}

/**
 * Move a task to a different status
 * @param taskId - The ID of the task to move
 * @param targetStatus - The key of the status to move the task to
 * @param projectId - The ID of the project
 * @returns The updated task
 */
export async function moveTask(
  taskId: string,
  targetStatus: string,
  projectId: string
) {
  // Wrapper for moveTaskCore
  try {
    // moveTaskCore is designed to fetch user if not provided.
    return await moveTaskCore({ taskId, targetStatusKey: targetStatus, projectId });
  } catch (error) {
    console.error("Error in langchain/tools wrapper for moveTask:", error);
    return null; // Original function returned null on error
  }
}

/**
 * Create a task tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for creating tasks
 */
export function createTaskTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "create_task",
    description: "Create a new task in the project",
    schema: z.object({
      title: z.string().describe("The title of the task"),
      description: z.string().describe("The description of the task"),
      status: z.string().optional().describe("The status of the task (e.g., 'BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().describe("The priority of the task"),
      // techIcons: z.array(z.string()).optional().describe("Array of tech icon slugs (e.g., 'typescript', 'react')") // Retain if needed by AI
    }),
    func: async ({ title, description, status, priority }) => { // techIcons removed from direct params for now
      try {
        // UserId can be omitted if createTaskCore handles it via Supabase session by default
        const task = await createTaskCore({ projectId, title, description, status, priority });
        return JSON.stringify({ success: true, task });
      } catch (error) {
        console.error("Error in create_task tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Update task tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for updating tasks
 */
export function updateTaskTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "update_task",
    description: "Update an existing task in the project",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to update"),
      title: z.string().optional().describe("The new title of the task"),
      description: z.string().optional().describe("The new description of the task"),
      status: z.string().optional().describe("The new status of the task (status_key)"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().describe("The new priority of the task"),
      // techIcons: z.array(z.string()).optional().describe("Array of tech icon slugs") // Retain if needed
      // due_date: z.string().optional().describe("The new due date (ISO string)") // Retain if needed
    }),
    func: async (updates) => { // updates will be { taskId, title, ... }
      try {
        const { taskId, ...updateValues } = updates;
        const task = await updateTaskCore(taskId, updateValues as TaskServiceUpdateData);
        return JSON.stringify({ success: true, task });
      } catch (error) {
        console.error("Error in update_task tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Delete task tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for deleting tasks
 */
export function deleteTaskTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "delete_task",
    description: "Delete a task from the project",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to delete"),
    }),
    func: async ({ taskId }) => {
      try {
        const success = await deleteTaskCore(taskId); // userId can be passed if needed by core function's auth model
        return JSON.stringify({ success });
      } catch (error) {
        console.error("Error in delete_task tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Create column tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for creating columns
 */
export function createColumnTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "create_column",
    description: "Create a new column (task status) in the project",
    schema: z.object({
      name: z.string().describe("The name of the column"),
      color: z.string().optional().describe("The color of the column (e.g., 'blue', 'green', 'red', etc.)"),
    }),
    func: async ({ name, color }) => {
      try {
        const status = await createTaskStatus(projectId, name, color);
        return JSON.stringify({ success: true, status });
      } catch (error) {
        console.error("Error in create_column tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Update column tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for updating columns
 */
export function updateColumnTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "update_column",
    description: "Update an existing column (task status) in the project",
    schema: z.object({
      statusId: z.string().describe("The ID of the column to update"),
      name: z.string().optional().describe("The new name of the column"),
      color: z.string().optional().describe("The new color of the column"),
      position: z.number().optional().describe("The new position of the column"),
    }),
    func: async ({ statusId, name, color, position }) => {
      try {
        const status = await updateTaskStatus(statusId, projectId, {
          name,
          color,
          position,
        });
        return JSON.stringify({ success: true, status });
      } catch (error) {
        console.error("Error in update_column tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Delete column tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for deleting columns
 */
export function deleteColumnTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "delete_column",
    description: "Delete a column (task status) from the project",
    schema: z.object({
      statusId: z.string().describe("The ID of the column to delete"),
      moveTasksTo: z.string().optional().describe("The ID of the column to move tasks to"),
    }),
    func: async ({ statusId, moveTasksTo }) => {
      try {
        const success = await deleteTaskStatus(statusId, projectId, moveTasksTo);
        return JSON.stringify({ success });
      } catch (error) {
        console.error("Error in delete_column tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Move task tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for moving tasks
 */
export function moveTaskTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "move_task",
    description: "Move a task to a different column",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to move"),
      targetStatus: z.string().describe("The key of the column to move the task to"),
    }),
    func: async ({ taskId, targetStatus }) => {
      try {
        const task = await moveTask(taskId, targetStatus, projectId); // This now calls the wrapper
        return JSON.stringify({ success: true, task });
      } catch (error) {
        console.error("Error in move_task tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Get project info tool
 * @param projectId - The ID of the project
 * @returns A LangChain tool for getting project info
 */
export function getProjectInfoTool(projectId: string) {
  return new DynamicStructuredTool({
    name: "get_project_info",
    description: "Get information about the project",
    schema: z.object({}), // No parameters needed for getProjectInfoTool
    func: async () => {
      try {
        const projectInfo = await getProjectInfoCore(projectId);
        return JSON.stringify({ success: true, projectInfo });
      } catch (error) {
        console.error("Error in get_project_info tool:", error);
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Get all tools for a project
 * @param projectId - The ID of the project
 * @returns An array of LangChain tools
 */
export function getProjectTools(projectId: string) {
  return [
    createTaskTool(projectId),
    updateTaskTool(projectId),
    deleteTaskTool(projectId),
    createColumnTool(projectId),
    updateColumnTool(projectId),
    deleteColumnTool(projectId),
    moveTaskTool(projectId),
    getProjectInfoTool(projectId),
  ];
}
