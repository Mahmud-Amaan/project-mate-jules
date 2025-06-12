import { NextResponse } from 'next/server';
import { db } from "@/db";
import { tasks, projectTaskStatuses } from "@/db/schema";
import { validateAuth } from "@/lib/auth/utils"; // Updated import path
import { isValidStatusEnum } from "@/utils/task-status"; // isValidStatusEnum remains
import { eq, asc, desc } from "drizzle-orm";
import { priorityConfig } from "@/config/dynamic-defaults";

/**
 * POST: Create a new task
 */
export async function POST(request: Request) {
  try {
    // Validate authentication
    const authResult = await validateAuth();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error.message }, { status: authResult.error.status });
    }
    const user = authResult.user!; // User is guaranteed to be non-null if error is null

    // Parse and validate request body
    const body = await request.json();
    const { projectId, title, description, priority, dueDate, status, status_key } = body;

    if (!projectId || !title) {
      return NextResponse.json(
        { error: 'Project ID and title are required' },
        { status: 400 }
      );
    }

    // Get the default status from the project's task statuses
    let defaultStatus = 'BACKLOG';
    // let defaultStatusKey = 'BACKLOG'; // Removed as it was unused

    try {
      // Try to find the default status for this project
      const projectStatuses = await db.query.projectTaskStatuses.findMany({
        where: eq(projectTaskStatuses.project_id, projectId),
        orderBy: [
          desc(projectTaskStatuses.is_default), // Default status first
          asc(projectTaskStatuses.order)        // Then by order
        ]
      });

      if (projectStatuses.length > 0) {
        // Use the first status (either default or lowest order)
        const firstStatus = projectStatuses[0];
        // defaultStatusKey = firstStatus.key; // Removed as it was unused

        // Map to enum value if possible
        if (isValidStatusEnum(firstStatus.key)) {
          defaultStatus = firstStatus.key;
        } else {
          // Otherwise map based on name
          const lowerName = firstStatus.name.toLowerCase();
          if (lowerName.includes('done') || lowerName.includes('complete')) {
            defaultStatus = 'DONE';
          } else if (lowerName.includes('progress') || lowerName.includes('doing')) {
            defaultStatus = 'IN_PROGRESS';
          } else if (lowerName.includes('todo')) {
            defaultStatus = 'TODO';
          } else {
            defaultStatus = 'BACKLOG';
          }
        }
      }
    } catch (error) {
      console.error('Error getting default status:', error);
      // Continue with fallback values
    }

    // Determine the status values
    const taskStatus = status || defaultStatus;
    const validEnum = isValidStatusEnum(taskStatus);
    const finalStatus = validEnum ? taskStatus : defaultStatus;
    const finalStatusKey = status_key || taskStatus;

    // Determine the priority value
    const finalPriority = priority || priorityConfig.default;

    // Create the task
    const [newTask] = await db.insert(tasks)
      .values({
        title: title.trim(),
        description: description?.trim() || null,
        priority: finalPriority,
        due_date: dueDate ? new Date(dueDate) : null,
        status: finalStatus,
        status_key: finalStatusKey,
        project_id: projectId,
        created_by: user.id,
        tech_icons: body.techIcons || null,
      })
      .returning();

    return NextResponse.json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}