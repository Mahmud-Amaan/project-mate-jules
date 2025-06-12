"use server"

import { db } from "@/db";
import { tasks, projectTaskStatuses } from "@/db/schema"; // Added projectTaskStatuses
import { eq, SQL, and } from "drizzle-orm"; // Added and
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { isValidStatusEnum } from "@/utils/task-status"; // For status validation

// Define TaskUpdatePayload based on what the API route currently accepts
export type TaskUpdatePayload = {
  status?: string;
  status_key?: string;
  title?: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  due_date?: string | null; // Assuming ISO string from client
  tech_icon?: string | null;
  tech_icons?: string[] | string | null;
};

// Define the actual structure for database update (subset of tasks schema)
export type TaskDbUpdateData = Partial<Omit<typeof tasks.$inferInsert, "id" | "project_id" | "created_by" | "created_at">>;

export async function prepareTaskUpdateData(
  currentTaskProjectId: string, // Pass projectId directly
  updates: TaskUpdatePayload
): Promise<TaskDbUpdateData> {
  const updateData: TaskDbUpdateData = {};

  // Handle status update
  const newStatusToProcess = updates.status; // status from body is the one to validate and map
  const newStatusKey = updates.status_key || updates.status; // status_key falls back to status if not provided

  if (newStatusToProcess) {
    const validFormat = isValidStatusEnum(newStatusToProcess);
    if (!validFormat) {
      throw new Error('Invalid status format. Status must be uppercase with underscores.');
    }

    const statusExists = await db.query.projectTaskStatuses.findFirst({
      where: and(
        eq(projectTaskStatuses.project_id, currentTaskProjectId),
        eq(projectTaskStatuses.key, newStatusToProcess)
      ),
    });

    if (!statusExists) {
      console.warn(`Status ${newStatusToProcess} does not exist for project ${currentTaskProjectId}`);
      // Depending on strictness, you might throw an error here or allow it
      // For now, allowing it as per original logic, but status_key will be set.
    }

    let enumStatus: typeof tasks.$inferInsert.status = 'BACKLOG';
    if (['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'].includes(newStatusToProcess)) {
      enumStatus = newStatusToProcess as typeof tasks.$inferInsert.status;
    } else if (['PLANNING', 'FRONTEND', 'BACKEND', 'TESTING'].includes(newStatusToProcess)) {
      enumStatus = 'IN_PROGRESS';
    } else if (newStatusToProcess === 'ARCHIVED') {
      enumStatus = 'DONE';
    }
    updateData.status = enumStatus;
    updateData.status_key = newStatusToProcess; // Always use the provided status as status_key
  } else if (updates.status_key) {
    // If only status_key is provided, set it.
    // We might want to also update the legacy `status` field based on this `status_key`
    // For now, only updating status_key as per original specific logic for this case.
    updateData.status_key = updates.status_key;
  }


  // Handle other field updates
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.due_date !== undefined) {
    updateData.due_date = updates.due_date ? new Date(updates.due_date) : null;
  }
  if (updates.tech_icon !== undefined) updateData.tech_icon = updates.tech_icon;

  if (updates.tech_icons !== undefined) {
    if (Array.isArray(updates.tech_icons)) {
      updateData.tech_icons = JSON.stringify(updates.tech_icons);
    } else if (typeof updates.tech_icons === 'string') {
      try {
        JSON.parse(updates.tech_icons); // Validate if it's a JSON string
        updateData.tech_icons = updates.tech_icons;
      } catch (_e) {
        updateData.tech_icons = JSON.stringify([updates.tech_icons]); // Wrap if single non-JSON string
      }
    } else if (updates.tech_icons === null) {
      updateData.tech_icons = JSON.stringify([]);
    } else {
      // For any other type, attempt to stringify (might not be ideal)
      updateData.tech_icons = JSON.stringify(updates.tech_icons);
    }
  }
  return updateData;
}

// Define TaskCreationPayload based on what the AI tool expects + userId
export type TaskCreationPayload = {
  projectId: string;
  title: string;
  description: string;
  status?: string; // Will default to BACKLOG
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; // Will default to MEDIUM
  techIcons?: string[];
  userId?: string; // Optional: If not provided, will try to get from Supabase session
};

export async function createTaskCore(payload: TaskCreationPayload) {
  const {
    projectId,
    title,
    description,
    status = "BACKLOG",
    priority = "MEDIUM",
    techIcons,
    userId: providedUserId,
  } = payload;

  if (!projectId || !title) {
    throw new Error("Project ID and title are required for creating a task.");
  }

  let userId = providedUserId;
  if (!userId) {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error("User authentication is required to create tasks.");
    }
    userId = authUser.id;
  }

  const validStatus = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE"].includes(status) ? status : "BACKLOG";
  const validPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM";

  let finalTechIcons = techIcons;
  if (!finalTechIcons || finalTechIcons.length === 0) {
    try {
      const { suggestTechIcons } = await import("@/lib/ai/tools/task/tech-icon-matcher");
      finalTechIcons = suggestTechIcons(title, description);
    } catch (iconError) {
      console.error("Error suggesting tech icons in createTaskCore:", iconError);
      finalTechIcons = []; // Default to empty array on error
    }
  }

  try {
    const [newTask] = await db
      .insert(tasks)
      .values({
        project_id: projectId,
        title,
        description,
        status: validStatus as "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE",
        status_key: validStatus, // Assuming status_key should mirror status initially
        priority: validPriority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        created_by: userId,
        tech_icons: finalTechIcons && finalTechIcons.length > 0 ? JSON.stringify(finalTechIcons) : null,
        tech_icon: finalTechIcons && finalTechIcons.length > 0 ? finalTechIcons[0] : null,
      })
      .returning();
    return newTask;
  } catch (dbError) {
    console.error("Database error creating task in createTaskCore:", dbError);
    throw dbError; // Re-throw original error
  }
}

export type MoveTaskPayload = {
  taskId: string;
  targetStatusKey: string;
  projectId: string;
  userId?: string; // For auth check
};

export async function moveTaskCore(payload: MoveTaskPayload) {
  const { taskId, targetStatusKey, projectId, userId: providedUserId } = payload;

  if (!taskId || !targetStatusKey || !projectId) {
    throw new Error("Task ID, Target Status Key, and Project ID are required for moving a task.");
  }

  let userId = providedUserId;
  if (!userId) { // Default to requiring auth
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error("User authentication is required to move tasks.");
    }
    userId = authUser.id;
    // TODO: Permission check: Does this user have rights to modify this task/project?
  }

  const taskToMove = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.project_id, projectId)),
  });

  if (!taskToMove) {
    throw new Error("Task not found or does not belong to the specified project.");
  }

  const targetStatus = await db.query.projectTaskStatuses.findFirst({
    where: and(
      eq(projectTaskStatuses.key, targetStatusKey),
      eq(projectTaskStatuses.project_id, projectId)
    ),
  });

  if (!targetStatus) {
    throw new Error(`Target status "${targetStatusKey}" not found in project ${projectId}.`);
  }

  // Determine the legacy status enum value based on the targetStatusKey
  let enumStatus: typeof tasks.$inferInsert.status = 'BACKLOG';
  if (['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'].includes(targetStatusKey)) {
    enumStatus = targetStatusKey as typeof tasks.$inferInsert.status;
  } else if (['PLANNING', 'FRONTEND', 'BACKEND', 'TESTING'].includes(targetStatusKey)) {
    enumStatus = 'IN_PROGRESS';
  } else if (targetStatusKey === 'ARCHIVED') {
    enumStatus = 'DONE';
  }
  // else, it defaults to 'BACKLOG', or you could throw an error if key must map to an enum value

  try {
    const [updatedTask] = await db
      .update(tasks)
      .set({
        status: enumStatus,
        status_key: targetStatusKey,
      })
      .where(eq(tasks.id, taskId))
      .returning();
    return updatedTask;
  } catch (dbError) {
    console.error(`Database error moving task ${taskId} to status ${targetStatusKey}:`, dbError);
    throw dbError;
  }
}

export async function getTaskStatusesCore(projectId: string) {
  if (!projectId) {
    // Match original behavior of returning [] or throwing, here choosing to be consistent
    // with other core functions and throwing, or returning empty if that's preferred contract.
    // Original in tools.ts returned [], so we'll stick to that for the "core" data fetching part.
    console.error("Project ID is required for getTaskStatusesCore");
    return [];
  }
  try {
    const statuses = await db
      .select()
      .from(projectTaskStatuses)
      .where(eq(projectTaskStatuses.project_id, projectId))
      .orderBy(projectTaskStatuses.order);
    return statuses || []; // Drizzle select should always return array, so || [] is defensive.
  } catch (error) {
    console.error(`Error fetching task statuses for project ${projectId} in getTaskStatusesCore:`, error);
    // To match original behavior of tool's getTaskStatuses, which returned [] on error.
    return [];
  }
}

export async function deleteTaskCore(taskId: string, userId?: string) {
  // If userId is provided, we might add a check to ensure the user has permission
  // or that the task belongs to one of their projects.
  // For now, directly mirrors the logic from langchain/tools.ts's deleteTask.

  if (!taskId) {
    throw new Error("Task ID is required for deleting a task.");
  }

  // Optional: Verify user authentication if userId is passed or required for all deletions
  if (userId) { // Example if we decide all deletions must be authenticated
    const supabase = await createClient(); // Assuming createClient is available
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser || authUser.id !== userId) {
      throw new Error("User authentication error or permission denied.");
    }
  } else {
    // If no userId is passed, and public deletion is not allowed,
    // one might fetch the task, find its owner/project, and check permissions.
    // The original langchain tool version did fetch user, implying a check.
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      // This makes deletion an authenticated action by default
      throw new Error("User authentication is required to delete tasks.");
    }
    // Further permission checks (e.g., is user owner/member of project) could be added here.
  }


  try {
    const taskResult = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });

    if (!taskResult) {
      // To match original tool's boolean return, we might return false or let error propagate
      // Throwing error is more informative for a "core" function.
      throw new Error("Task not found.");
    }

    await db.delete(tasks).where(eq(tasks.id, taskId));
    return true; // Indicate success
  } catch (dbError) {
    console.error(`Database error deleting task ${taskId} in deleteTaskCore:`, dbError);
    throw dbError; // Re-throw original error
  }
}

export type TaskStatusCreationPayload = {
  projectId: string;
  name: string;
  color?: string;
  userId?: string; // For auth check
};

export async function createTaskStatusCore(payload: TaskStatusCreationPayload) {
  const { projectId, name, color, userId: providedUserId } = payload;

  if (!projectId || !name) {
    throw new Error("Project ID and status name are required.");
  }

  let userId = providedUserId;
  if (!userId) { // Default to requiring auth if no userId is passed
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error("User authentication is required to create task statuses.");
    }
    userId = authUser.id;
    // TODO: Further check if this user has permission for the projectId
  }

  try {
    const statuses = await getTaskStatusesCore(projectId);
    const maxOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.order || 0)) : -1;
    const key = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");

    if (statuses.some(s => s.key === key)) {
      throw new Error(`Status with key ${key} already exists in this project.`);
    }

    const [newStatus] = await db
      .insert(projectTaskStatuses)
      .values({
        name,
        key,
        color: color || "gray", // Default color
        project_id: projectId,
        order: maxOrder + 1,
        is_default: false, // New statuses are not default
      })
      .returning();
    return newStatus;
  } catch (error) {
    console.error(`Error creating task status "${name}" for project ${projectId}:`, error);
    throw error; // Re-throw original or a new error
  }
}

export type TaskStatusUpdatePayload = {
  name?: string;
  color?: string;
  order?: number; // Renamed from 'position' for consistency with DB schema
};

export async function updateTaskStatusCore(
  statusId: string,
  projectId: string,
  updates: TaskStatusUpdatePayload,
  userId?: string // For auth check
) {
  if (!statusId || !projectId) {
    throw new Error("Status ID and Project ID are required.");
  }
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error("No updates provided.");
  }

  if (userId) { // Optional auth check
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser || authUser.id !== userId) {
      throw new Error("User authentication error or permission denied for updating task status.");
    }
    // TODO: Further check if this user has permission for the projectId
  } else { // Default to requiring auth
     const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error("User authentication is required to update task statuses.");
    }
  }


  const currentStatus = await db.query.projectTaskStatuses.findFirst({
    where: and(eq(projectTaskStatuses.id, statusId), eq(projectTaskStatuses.project_id, projectId)),
  });

  if (!currentStatus) {
    throw new Error("Task status not found or does not belong to the project.");
  }

  const updateValues: Partial<typeof projectTaskStatuses.$inferInsert> = {};
  if (updates.name) {
    updateValues.name = updates.name;
    updateValues.key = updates.name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    // Check for key collision if new key is generated
    if (updateValues.key !== currentStatus.key) {
      const statuses = await getTaskStatusesCore(projectId);
      if (statuses.some(s => s.key === updateValues.key && s.id !== statusId)) {
        throw new Error(`Another status with key ${updateValues.key} already exists.`);
      }
    }
  }
  if (updates.color) updateValues.color = updates.color;
  if (updates.order !== undefined) updateValues.order = updates.order;

  if (Object.keys(updateValues).length === 0) {
    return currentStatus; // No actual changes
  }

  try {
    const [updatedStatus] = await db
      .update(projectTaskStatuses)
      .set(updateValues)
      .where(eq(projectTaskStatuses.id, statusId))
      .returning();
    return updatedStatus;
  } catch (error) {
    console.error(`Error updating task status ${statusId}:`, error);
    throw error;
  }
}

export type DeleteTaskStatusOptions = {
  moveTasksToStatusKey?: string;
  userId?: string; // For auth check
};

export async function deleteTaskStatusCore(
  statusId: string,
  projectId: string,
  options: DeleteTaskStatusOptions = {}
): Promise<boolean> {
  const { moveTasksToStatusKey, userId: providedUserId } = options;

  if (!statusId || !projectId) {
    throw new Error("Status ID and Project ID are required for deleting a task status.");
  }

  let userId = providedUserId;
  if (!userId) { // Default to requiring auth
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error("User authentication is required to delete task statuses.");
    }
    userId = authUser.id;
    // TODO: Permission check: Does this user have rights to modify this project?
  }

  const statusToDelete = await db.query.projectTaskStatuses.findFirst({
    where: and(
      eq(projectTaskStatuses.id, statusId),
      eq(projectTaskStatuses.project_id, projectId)
    ),
  });

  if (!statusToDelete) {
    throw new Error("Task status not found or does not belong to the project.");
  }

  if (statusToDelete.is_default) {
    throw new Error("Cannot delete the default task status.");
  }

  if (moveTasksToStatusKey) {
    const targetStatus = await db.query.projectTaskStatuses.findFirst({
      where: and(
        eq(projectTaskStatuses.key, moveTasksToStatusKey),
        eq(projectTaskStatuses.project_id, projectId)
      ),
    });

    if (!targetStatus) {
      throw new Error(`Target status key "${moveTasksToStatusKey}" not found for project ${projectId}.`);
    }

    // Safer status mapping
    let enumStatus: typeof tasks.$inferInsert.status = 'BACKLOG'; // Default
    if (['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'].includes(targetStatus.key)) {
      enumStatus = targetStatus.key as typeof tasks.$inferInsert.status;
    } else if (['PLANNING', 'FRONTEND', 'BACKEND', 'TESTING'].includes(targetStatus.key)) {
      enumStatus = 'IN_PROGRESS';
    } else if (targetStatus.key === 'ARCHIVED') {
      enumStatus = 'DONE';
    }

    await db
      .update(tasks)
      .set({
        status: enumStatus,
        status_key: targetStatus.key,
      })
      .where(
        and(
          eq(tasks.project_id, projectId),
          eq(tasks.status_key, statusToDelete.key)
        )
      );
  } else {
    // Optional: Check if there are tasks in this status and throw error or handle as needed
    const tasksInStatus = await db.query.tasks.findMany({
        where: and(
            eq(tasks.project_id, projectId),
            eq(tasks.status_key, statusToDelete.key)
        ),
        limit: 1
    });
    if (tasksInStatus.length > 0) {
        throw new Error(`Cannot delete status "${statusToDelete.name}" as it still contains tasks. Please move tasks to another status first or specify a target status.`);
    }
  }

  await db.delete(projectTaskStatuses).where(eq(projectTaskStatuses.id, statusId));
  return true;
}


// Define TaskUpdateData (from langchain tools) + optional techIcons for consistency
export type TaskServiceUpdateData = {
  title?: string;
  description?: string;
  status?: string; // This is status_key
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  due_date?: Date | string | null;
  techIcons?: string[];
};

export async function updateTaskCore(taskId: string, updates: TaskServiceUpdateData) {
  if (!taskId) {
    throw new Error("Task ID is required for updating a task.");
  }

  // Note: Original langchain/tools updateTask also fetched user for auth,
  // but this core function will omit it for now, assuming auth is handled by caller if necessary.
  // Or, it could be added similar to createTaskCore if all updates must be auth'd.

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) {
    throw new Error("Task not found.");
  }

  const validatedUpdates: TaskDbUpdateData = {}; // Use existing TaskDbUpdateData

  // Status handling (maps to status_key and legacy status)
  if (updates.status) {
    const newStatusToProcess = updates.status;
    const validFormat = isValidStatusEnum(newStatusToProcess); // Ensure this util is available or reimplement
    if (!validFormat) {
      throw new Error('Invalid status format. Status must be uppercase with underscores.');
    }

    // Check if the status exists for this project (optional, based on strictness)
    const statusExists = await db.query.projectTaskStatuses.findFirst({
      where: and(
        eq(projectTaskStatuses.project_id, task.project_id),
        eq(projectTaskStatuses.key, newStatusToProcess)
      ),
    });
    if (!statusExists) {
      console.warn(`Status ${newStatusToProcess} does not exist for project ${task.project_id}.`);
    }

    let enumStatus: typeof tasks.$inferInsert.status = 'BACKLOG';
    if (['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'].includes(newStatusToProcess)) {
      enumStatus = newStatusToProcess as typeof tasks.$inferInsert.status;
    } else if (['PLANNING', 'FRONTEND', 'BACKEND', 'TESTING'].includes(newStatusToProcess)) {
      enumStatus = 'IN_PROGRESS';
    } else if (newStatusToProcess === 'ARCHIVED') {
      enumStatus = 'DONE';
    }
    validatedUpdates.status = enumStatus;
    validatedUpdates.status_key = newStatusToProcess;
  }

  if (updates.priority) {
    validatedUpdates.priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(updates.priority)
      ? updates.priority
      : task.priority;
  }

  if (updates.title !== undefined) validatedUpdates.title = updates.title;
  if (updates.description !== undefined) validatedUpdates.description = updates.description;

  if (updates.due_date !== undefined) {
    validatedUpdates.due_date = updates.due_date ? new Date(updates.due_date) : null;
  }

  // Handle tech icons
  if (updates.techIcons !== undefined) {
    if (updates.techIcons && updates.techIcons.length > 0) {
      validatedUpdates.tech_icons = JSON.stringify(updates.techIcons);
      validatedUpdates.tech_icon = updates.techIcons[0];
    } else {
      validatedUpdates.tech_icons = null;
      validatedUpdates.tech_icon = null;
    }
  } else if (updates.title || updates.description) {
    // Auto-suggest if title/description changed and techIcons not explicitly passed
    try {
      const { suggestTechIcons } = await import("@/lib/ai/tools/task/tech-icon-matcher");
      const title = updates.title || task.title;
      const description = updates.description || task.description || "";
      const suggestedIcons = suggestTechIcons(title, description);
      if (suggestedIcons.length > 0) {
        validatedUpdates.tech_icons = JSON.stringify(suggestedIcons);
        validatedUpdates.tech_icon = suggestedIcons[0];
      }
    } catch (iconError) {
      console.error("Error suggesting tech icons for task update in updateTaskCore:", iconError);
    }
  }

  if (Object.keys(validatedUpdates).length === 0) {
    return task; // No actual changes to apply
  }

  try {
    const [updatedTask] = await db
      .update(tasks)
      .set(validatedUpdates)
      .where(eq(tasks.id, taskId))
      .returning();
    return updatedTask;
  } catch (dbError) {
    console.error("Database error updating task in updateTaskCore:", dbError);
    throw dbError;
  }
}


/**
 * Core function to fetch project tasks from the database.
 * @param projectId - The ID of the project.
 * @param options - Optional query options like orderBy.
 * @returns A promise that resolves to an array of tasks or throws an error.
 */
export async function fetchProjectTasksCore(
  projectId: string,
  options?: { orderBy?: SQL | SQL[] }
) {
  let query = db.select().from(tasks).where(eq(tasks.project_id, projectId));

  if (options?.orderBy) {
    // Drizzle's orderBy can take a single SQL instance or an array
    if (Array.isArray(options.orderBy)) {
      query = query.orderBy(...options.orderBy);
    } else {
      query = query.orderBy(options.orderBy);
    }
  }
  // If no orderBy is provided, Drizzle handles it (usually by primary key or insertion order)

  try {
    const projectTasks = await query;
    return projectTasks;
  } catch (error) {
    console.error(`Error fetching tasks for project ${projectId} from DB:`, error);
    throw error; // Re-throw to be handled by calling function
  }
}

export async function getProjectTasks(project_id: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/signin");
  }

  try {
    // Call the core function with sorting options
    const projectTasks = await fetchProjectTasksCore(project_id, { // Use new name
      orderBy: tasks.created_at,
    });
    return projectTasks;
  } catch (error) {
    // The public function still returns [] on error as per its original contract
    console.error("Error in getProjectTasks (public):", error);
    return [];
  }
}
