import { NextResponse } from 'next/server';
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateAuth } from "@/lib/auth/utils"; // Updated import path
import { prepareTaskUpdateData, TaskUpdatePayload } from "@/lib/tasks";

/**
 * PATCH: Update a task's properties (status, title, description, priority, due_date, etc.)
 */
export async function PATCH(request: Request) {
  try {
    // Validate authentication
    const authResult = await validateAuth();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error.message }, { status: authResult.error.status });
    }
    // const user = authResult.user; // user is available if needed

    // Parse and validate request body
    const body = await request.json();
    const { taskId, status, status_key, title, description, priority, due_date, tech_icon, tech_icons } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // First, get the task to check if it exists and get its project_id
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Use the new service function to prepare update data
    // The body contains { taskId, status, status_key, title, ... }
    // We need to pass the updatable fields to prepareTaskUpdateData
    const updatableFields: TaskUpdatePayload = {
      status, status_key, title, description, priority, due_date, tech_icon, tech_icons
    };
    const updateData = await prepareTaskUpdateData(task.project_id, updatableFields);

    if (Object.keys(updateData).length === 0) {
      // No valid fields to update, or nothing changed that needs updating
      // Return the current task or a message
      return NextResponse.json(task);
    }

    console.log(`Updating task ${taskId} with prepared data:`, updateData);

    // Update the task in the database
    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}