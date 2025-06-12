import { NextResponse } from 'next/server';
import { db } from "@/db";
import { projectTaskStatuses, projects } from "@/db/schema";
import { eq, and, InferSelectModel } from "drizzle-orm";
import { validateAuth } from "@/lib/auth/utils"; // Updated import path
import { generateDynamicColumns } from "@/utils/task-status"; // generateDynamicColumns remains

type ProjectTaskStatus = InferSelectModel<typeof projectTaskStatuses>;

/**
 * POST: Initialize default task statuses for a project
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Validate authentication
    const authResult = await validateAuth();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error.message }, { status: authResult.error.status });
    }
    // const user = authResult.user; // user is available if needed, but not used in this specific function

    const { projectId } = await params;

    // Get project details to generate dynamic columns based on project description
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    // Check if the project already has task statuses
    const existingStatuses = await db.query.projectTaskStatuses.findMany({
      where: eq(projectTaskStatuses.project_id, projectId),
    });

    // If we already have statuses, just return them
    if (existingStatuses.length > 0) {
      console.log(`Project ${projectId} already has ${existingStatuses.length} statuses:`,
        existingStatuses.map(s => `${s.name} (${s.key})`).join(', '));
      return NextResponse.json(
        { message: 'Project already has task statuses', statuses: existingStatuses },
        { status: 200 }
      );
    }

    // Generate dynamic columns based on project description
    const dynamicColumns = project?.description
      ? generateDynamicColumns(project.description)
      : generateDynamicColumns("Software Development Project");

    // Initialize task statuses without a transaction for better error handling
    const statuses = [];

    // Create a map of existing statuses by key for quick lookup
    const existingStatusMap: Record<string, ProjectTaskStatus> = {};
    for (const existingStatus of existingStatuses) {
      existingStatusMap[existingStatus.key] = existingStatus;
    }

    console.log(`Project ${projectId} has ${existingStatuses.length} existing statuses. Adding dynamic columns.`);

    // Process each dynamic column individually
    for (const status of dynamicColumns) {
      try {
        // Skip if status already exists
        if (existingStatusMap[status.key]) {
          console.log(`Status ${status.key} already exists, skipping creation`);
          statuses.push(existingStatusMap[status.key]);
          continue;
        }

        // Create the status if it doesn't exist
        const [newStatus] = await db.insert(projectTaskStatuses)
          .values({
            project_id: projectId,
            name: status.name,
            key: status.key,
            color: status.color || 'bg-gray-50 dark:bg-gray-900',
            order: typeof status.order === 'number' ? status.order : 0,
            is_default: status.is_default || false,
          })
          .returning();

        if (newStatus) {
          statuses.push(newStatus);
          console.log(`Created status: ${status.name} (${status.key})`);
        }
      } catch (statusError) {
        console.error(`Error creating status ${status.key}:`, statusError);

        // If it's a duplicate key error, try to fetch the existing status
        const errorMessage = statusError instanceof Error ? statusError.message : String(statusError);
        if (errorMessage.includes('duplicate key value violates unique constraint')) {
          try {
            // Fetch the existing status
            const existingStatus = await db.query.projectTaskStatuses.findFirst({
              where: and(
                eq(projectTaskStatuses.project_id, projectId),
                eq(projectTaskStatuses.key, status.key)
              ),
            });

            if (existingStatus && !statuses.some(s => s.key === status.key)) {
              // Add the existing status to our list
              statuses.push(existingStatus);
              console.log(`Found existing ${status.key} status after duplicate key error`);
            }
          } catch (fetchError) {
            console.error(`Error fetching existing ${status.key} status:`, fetchError);
          }
        }
        // Continue with other statuses even if one fails
      }
    }

    // If we have no statuses yet, create at least a minimal set of columns as fallback
    if (statuses.length === 0) {
      try {
        console.log('Creating minimal fallback columns');

        // Create a minimal set of columns: Backlog, In Progress, Done
        const minimalColumns = [
          {
            name: 'Backlog',
            key: 'BACKLOG',
            color: 'bg-gray-50 dark:bg-gray-900',
            order: 0,
            is_default: true,
          },
          {
            name: 'In Progress',
            key: 'IN_PROGRESS',
            color: 'bg-blue-50 dark:bg-blue-900/20',
            order: 1,
            is_default: false,
          },
          {
            name: 'Done',
            key: 'DONE',
            color: 'bg-emerald-50 dark:bg-emerald-900/20',
            order: 2,
            is_default: false,
          }
        ];

        // Try to create each minimal column
        for (const column of minimalColumns) {
          try {
            // Check if column already exists
            if (!existingStatusMap[column.key]) {
              const [newStatus] = await db.insert(projectTaskStatuses)
                .values({
                  project_id: projectId,
                  name: column.name,
                  key: column.key,
                  color: column.color,
                  order: column.order,
                  is_default: column.is_default,
                })
                .returning();

              if (newStatus) {
                statuses.push(newStatus);
                console.log(`Created fallback ${column.key} status successfully`);
              }
            } else {
              // Use the existing status
              statuses.push(existingStatusMap[column.key]);
              console.log(`Using existing ${column.key} status`);
            }
          } catch (columnError) {
            console.error(`Error creating fallback ${column.key} status:`, columnError);

            // Try to fetch the status if it exists but we couldn't create it
            try {
              const existingStatus = await db.query.projectTaskStatuses.findFirst({
                where: and(
                  eq(projectTaskStatuses.project_id, projectId),
                  eq(projectTaskStatuses.key, column.key)
                ),
              });

              if (existingStatus) {
                statuses.push(existingStatus);
                console.log(`Found existing ${column.key} status`);
              }
            } catch (fetchError) {
              console.error(`Error fetching existing ${column.key} status:`, fetchError);
            }
          }
        }
      } catch (fallbackError) {
        console.error('Error handling fallback statuses:', fallbackError);
      }
    }

    // Always fetch all current statuses to ensure we return everything
    // This handles race conditions where statuses might have been created in parallel
    const currentStatuses = await db.query.projectTaskStatuses.findMany({
      where: eq(projectTaskStatuses.project_id, projectId),
      orderBy: projectTaskStatuses.order,
    });

    console.log(`Returning ${currentStatuses.length} statuses for project ${projectId}:`,
      currentStatuses.map(s => `${s.name} (${s.key})`).join(', '));

    return NextResponse.json(currentStatuses);
  } catch (error) {
    console.error('Error initializing task statuses:', error);
    return NextResponse.json(
      { error: 'Failed to initialize task statuses' },
      { status: 500 }
    );
  }
}