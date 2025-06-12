/**
 * Task Operations Tools
 * This file contains functions for creating, updating, and deleting tasks
 */

import { db } from "@/db"; // db import might become unused if all direct db calls are removed
import { tasks } from "@/db/schema"; // tasks import might become unused
import { eq } from "drizzle-orm"; // eq import might become unused
import { z } from "zod";
import { getTaskStatuses } from "./task-status";
import { fetchProjectTasksCore } from "@/lib/tasks"; // Import the core function

/**
 * Get project tasks
 * @param projectId - The ID of the project
 * @returns Project tasks
 */
export async function getProjectTasks(projectId: string) {
  try {
    // Get the tasks using the core function
    // No specific sorting needed for this version
    const projectTasks = await fetchProjectTasksCore(projectId);
    return projectTasks;
  } catch (error) {
    // The core function throws, so this catch block will handle it
    console.error("Failed to get project tasks (task-operations):", error);
    throw error;
  }
}

/**
 * Get project tasks tool
 * @param projectId - The ID of the project
 * @returns A tool for getting project tasks
 */
export function getProjectTasksTool(projectId: string) {
  return {
    name: "get_project_tasks",
    description: "Get all tasks in the project. Use this when you need to know what tasks exist.",
    schema: z.object({
      status: z.string().optional().describe("Filter tasks by status"),
    }),
    func: async ({ status }: { status?: string }) => {
      try {
        const projectTasks = await getProjectTasks(projectId);

        if (status) {
          return projectTasks.filter(task =>
            task.status === status || task.status_key === status
          );
        }

        return projectTasks;
      } catch (error) {
        console.error("Failed to get project tasks:", error);
        return { error: "Failed to get project tasks" };
      }
    },
  };
}

/**
 * Create a task
 * @param projectId - The ID of the project
 * @param title - The title of the task
 * @param description - The description of the task
 * @param status - The status of the task
 * @param priority - The priority of the task
 * @param assigneeId - The ID of the assignee
 * @param dueDate - The due date of the task
 * @returns The created task
 */
export async function createTask(
  projectId: string,
  title: string,
  description: string,
  status: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  assigneeId?: string,
  dueDate?: Date
) {
  try {
    // Get the task statuses to validate the status
    const taskStatuses = await getTaskStatuses(projectId);
    const statusKeys = taskStatuses.map(status => status.key);

    // Use the status key if it exists, otherwise use the default status
    const statusKey = statusKeys.includes(status) ? status : "BACKLOG";

    // Create the task
    const [task] = await db
      .insert(tasks)
      .values({
        title,
        description,
        status: status === "BACKLOG" ? "BACKLOG" :
               status === "TODO" ? "TODO" :
               status === "IN_PROGRESS" ? "IN_PROGRESS" :
               status === "DONE" ? "DONE" : "BACKLOG", // Map to enum values for backward compatibility
        status_key: statusKey, // Store the custom status key
        priority,
        project_id: projectId,
        created_by: assigneeId || 'unknown',
        due_date: dueDate,
      })
      .returning();

    return task;
  } catch (error) {
    console.error("Failed to create task:", error);
    throw error;
  }
}

/**
 * Create task tool
 * @param projectId - The ID of the project
 * @returns A tool for creating a task
 */
export function createTaskTool(projectId: string) {
  return {
    name: "create_task",
    description: "Create a new task in the project. Use this when the user wants to add a task.",
    schema: z.object({
      title: z.string().describe("The title of the task"),
      description: z.string().describe("The description of the task"),
      status: z.string().describe("The status of the task (e.g., 'BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).describe("The priority of the task"),
      assigneeId: z.string().optional().describe("The ID of the assignee"),
      dueDate: z.string().optional().describe("The due date of the task (ISO format)"),
    }),
    func: async ({ title, description, status, priority, assigneeId, dueDate }: {
      title: string;
      description: string;
      status: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      assigneeId?: string;
      dueDate?: string;
    }) => {
      try {
        // Parse the due date if provided
        const parsedDueDate = dueDate ? new Date(dueDate) : undefined;

        // Create the task
        const task = await createTask(
          projectId,
          title,
          description,
          status,
          priority,
          assigneeId,
          parsedDueDate
        );

        return task;
      } catch (error) {
        console.error("Failed to create task:", error);
        return { error: "Failed to create task" };
      }
    },
  };
}

/**
 * Update a task
 * @param taskId - The ID of the task
 * @param title - The title of the task
 * @param description - The description of the task
 * @param status - The status of the task
 * @param priority - The priority of the task
 * @param assigneeId - The ID of the assignee
 * @param dueDate - The due date of the task
 * @returns The updated task
 */
export async function updateTask(
  taskId: string,
  title?: string,
  description?: string,
  status?: string,
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  assigneeId?: string,
  dueDate?: Date
) {
  try {
    // Get the task to get the project ID
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!task) {
      throw new Error("Task not found");
    }

    // Get the task statuses to validate the status
    const taskStatuses = await getTaskStatuses(task.project_id);
    const statusKeys = taskStatuses.map(status => status.key);

    // Use the status key if it exists, otherwise use the current status
    const statusKey = status && statusKeys.includes(status) ? status : task.status_key;

    // Update the task
    const [updatedTask] = await db
      .update(tasks)
      .set({
        title,
        description,
        status: status === "BACKLOG" ? "BACKLOG" :
               status === "TODO" ? "TODO" :
               status === "IN_PROGRESS" ? "IN_PROGRESS" :
               status === "DONE" ? "DONE" : task.status, // Map to enum values for backward compatibility
        status_key: statusKey, // Store the custom status key
        priority,
        // assignee_id is not in the schema, using created_by instead
        due_date: dueDate,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return updatedTask;
  } catch (error) {
    console.error("Failed to update task:", error);
    throw error;
  }
}

/**
 * Update task tool
 * @param projectId - The ID of the project
 * @returns A tool for updating a task
 */
export function updateTaskTool(_projectId: string) {
  return {
    name: "update_task",
    description: "Update an existing task in the project. Use this when the user wants to modify a task.",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to update"),
      title: z.string().optional().describe("The new title of the task"),
      description: z.string().optional().describe("The new description of the task"),
      status: z.string().optional().describe("The new status of the task (e.g., 'BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().describe("The new priority of the task"),
      assigneeId: z.string().optional().describe("The new ID of the assignee"),
      dueDate: z.string().optional().describe("The new due date of the task (ISO format)"),
    }),
    func: async ({ taskId, title, description, status, priority, assigneeId, dueDate }: {
      taskId: string;
      title?: string;
      description?: string;
      status?: string;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      assigneeId?: string;
      dueDate?: string;
    }) => {
      try {
        // Parse the due date if provided
        const parsedDueDate = dueDate ? new Date(dueDate) : undefined;

        // Update the task
        const task = await updateTask(
          taskId,
          title,
          description,
          status,
          priority,
          assigneeId,
          parsedDueDate
        );

        return task;
      } catch (error) {
        console.error("Failed to update task:", error);
        return { error: "Failed to update task" };
      }
    },
  };
}

/**
 * Delete a task
 * @param taskId - The ID of the task
 * @returns The deleted task
 */
export async function deleteTask(taskId: string) {
  try {
    // Delete the task
    const [task] = await db
      .delete(tasks)
      .where(eq(tasks.id, taskId))
      .returning();

    return task;
  } catch (error) {
    console.error("Failed to delete task:", error);
    throw error;
  }
}

/**
 * Delete task tool
 * @param projectId - The ID of the project
 * @returns A tool for deleting a task
 */
export function deleteTaskTool(_projectId: string) {
  return {
    name: "delete_task",
    description: "Delete a task from the project. Use this when the user wants to remove a task.",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to delete"),
    }),
    func: async ({ taskId }: { taskId: string }) => {
      try {
        // Delete the task
        const task = await deleteTask(taskId);

        return task;
      } catch (error) {
        console.error("Failed to delete task:", error);
        return { error: "Failed to delete task" };
      }
    },
  };
}

/**
 * Move a task to a different status
 * @param taskId - The ID of the task
 * @param status - The new status of the task
 * @returns The moved task
 */
export async function moveTask(taskId: string, status: string, projectId?: string) {
  try {
    // Get the task to get the project ID
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!task) {
      throw new Error("Task not found");
    }

    // Get the task statuses to validate the status
    const taskStatuses = await getTaskStatuses(task.project_id);
    const statusKeys = taskStatuses.map(status => status.key);

    // Use the status key if it exists, otherwise use the current status
    const statusKey = statusKeys.includes(status) ? status : task.status_key;

    // Update the task
    const [updatedTask] = await db
      .update(tasks)
      .set({
        status: status === "BACKLOG" ? "BACKLOG" :
               status === "TODO" ? "TODO" :
               status === "IN_PROGRESS" ? "IN_PROGRESS" :
               status === "DONE" ? "DONE" : task.status, // Map to enum values for backward compatibility
        status_key: statusKey, // Store the custom status key
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return updatedTask;
  } catch (error) {
    console.error("Failed to move task:", error);
    throw error;
  }
}

/**
 * Move task tool
 * @param projectId - The ID of the project
 * @returns A tool for moving a task
 */
export function moveTaskTool(_projectId: string) {
  return {
    name: "move_task",
    description: "Move a task to a different status. Use this when the user wants to change the status of a task.",
    schema: z.object({
      taskId: z.string().describe("The ID of the task to move"),
      status: z.string().describe("The new status of the task"),
    }),
    func: async ({ taskId, status }: { taskId: string; status: string }) => {
      try {
        // Move the task
        const task = await moveTask(taskId, status);

        return task;
      } catch (error) {
        console.error("Failed to move task:", error);
        return { error: "Failed to move task" };
      }
    },
  };
}
