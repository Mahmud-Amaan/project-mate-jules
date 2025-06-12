import { NextResponse } from 'next/server';
import { db } from "@/db";
import { projectTaskStatuses, tasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { validateAuth } from "@/lib/auth/utils"; // Updated import path for validateAuth
import { getTaskStatus, moveTasksToStatus } from "@/utils/task-status"; // Other imports remain

/**
 * PATCH: Update a task status
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; statusId: string }> }
) {
  try {
    // Validate authentication
    const authResult = await validateAuth();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error.message }, { status: authResult.error.status });
    }
    // const user = authResult.user; // User is available if needed

    const { projectId, statusId } = await params;

    // Get and validate task status
    const statusResult = await getTaskStatus(projectId, statusId);
    if (statusResult.error) return statusResult.error;

    const existingStatus = statusResult.status;

    // Parse request body
    const body = await request.json();
    const { name, color, order } = body;

    // Prepare update data
    const updateData: Partial<typeof projectTaskStatuses.$inferInsert> = {
      updated_at: new Date(),
    };

    // Check if this is a default status (BACKLOG) which should be protected
    if (existingStatus.is_default && existingStatus.key === 'BACKLOG') {
      // For BACKLOG, only allow updating the color and order, not the name
      if (color) updateData.color = color;
      if (order !== undefined) updateData.order = order;
    } else {
      // For non-BACKLOG statuses, allow updating name, color, and order
      if (name) updateData.name = name.trim();
      if (color) updateData.color = color;
      if (order !== undefined) updateData.order = order;
    }

    // Update the task status
    const [updatedStatus] = await db.update(projectTaskStatuses)
      .set(updateData)
      .where(eq(projectTaskStatuses.id, statusId))
      .returning();

    return NextResponse.json(updatedStatus);
  } catch (error) {
    console.error('Error updating task status:', error);
    return NextResponse.json(
      { error: 'Failed to update task status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a task status
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; statusId: string }> }
) {
  try {
    // Validate authentication
    const authResult = await validateAuth();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error.message }, { status: authResult.error.status });
    }
    // const user = authResult.user; // User is available if needed

    const { projectId, statusId } = await params;

    // Get and validate task status
    const statusResult = await getTaskStatus(projectId, statusId);
    if (statusResult.error) return statusResult.error;

    const existingStatus = statusResult.status;

    // Check if this is a default status which should be protected
    if (existingStatus.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete default task status' },
        { status: 400 }
      );
    }

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Check if there are any tasks using this status
      const tasksWithStatus = await tx.query.tasks.findMany({
        where: and(
          eq(tasks.project_id, projectId),
          eq(tasks.status_key, existingStatus.key)
        ),
      });

      // If there are tasks with this status, move them to BACKLOG
      if (tasksWithStatus.length > 0) {
        // Find the BACKLOG status
        const backlogStatus = await tx.query.projectTaskStatuses.findFirst({
          where: and(
            eq(projectTaskStatuses.project_id, projectId),
            eq(projectTaskStatuses.key, 'BACKLOG')
          ),
        });

        if (!backlogStatus) {
          throw new Error('BACKLOG status not found');
        }

        // Move tasks to BACKLOG
        await moveTasksToStatus(tx, projectId, existingStatus.key, 'BACKLOG');
      }

      // Delete the task status
      await tx.delete(projectTaskStatuses)
        .where(eq(projectTaskStatuses.id, statusId));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task status:', error);
    return NextResponse.json(
      { error: 'Failed to delete task status' },
      { status: 500 }
    );
  }
}
