import { NextResponse } from 'next/server';
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateAuth } from "@/lib/auth/utils"; // Updated import path

/**
 * PATCH: Edit a task's details
 */
export async function PATCH(request: Request) {
  try {
    // Validate authentication
    const authResult = await validateAuth();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error.message }, { status: authResult.error.status });
    }
    // const user = authResult.user; // user is available if needed, but not used directly in this function

    // Parse and validate request body
    const body = await request.json();
    const { taskId, title, description, priority, status, status_key } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Partial<typeof tasks.$inferInsert> = {};

    // Update fields if provided
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (priority) updateData.priority = priority;

    // Handle status update
    if (status) {
      // Map the status to a valid enum value for the status field
      let enumStatus = 'BACKLOG';
      if (status === 'BACKLOG' || status === 'TODO' || status === 'IN_PROGRESS' || status === 'DONE') {
        // If the status is one of the enum values, use it directly
        enumStatus = status;
      } else if (status === 'PLANNING' || status === 'FRONTEND' || status === 'BACKEND' || status === 'TESTING') {
        // Map custom statuses to the closest enum value
        enumStatus = 'IN_PROGRESS';
      } else if (status === 'ARCHIVED') {
        enumStatus = 'DONE';
      }

      // Set status to a valid enum value
      updateData.status = enumStatus as "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE";

      // If status_key is explicitly provided, use it, otherwise use status
      updateData.status_key = status_key || status;

      console.log(`Editing task ${taskId} with status_key=${updateData.status_key} and status=${updateData.status}`);
    }

    // Update the task
    const [updatedTask] = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}