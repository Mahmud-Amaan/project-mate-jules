import { NextResponse } from 'next/server';
// import { createClient } from "@/utils/supabase/server"; // Removed as it was only used by validateAuth
import { db } from "@/db";
import { projectTaskStatuses, tasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isValidStatusEnum } from "./task-status-client";
import type { ValidStatusEnum } from "./task-status-client";
import {
  minimalFallbackColumns,
  normalizeStatusKey,
  isValidStatusKey,
  generateDynamicColumns
} from "@/config/dynamic-defaults";

// Use dynamic configuration for default statuses
const SERVER_DEFAULT_STATUSES = minimalFallbackColumns;

// Re-export for convenience
export {
  minimalFallbackColumns as DEFAULT_STATUSES,
  isValidStatusEnum,
  normalizeStatusKey,
  ValidStatusEnum,
  SERVER_DEFAULT_STATUSES,
  generateDynamicColumns,
  isValidStatusKey
};

// validateAuth function removed from here

/**
 * Fetches a task status and validates it belongs to the project
 * @param projectId Project ID
 * @param statusId Status ID
 * @returns Task status or error response
 */
export async function getTaskStatus(projectId: string, statusId: string) {
  const status = await db.query.projectTaskStatuses.findFirst({
    where: and(
      eq(projectTaskStatuses.id, statusId),
      eq(projectTaskStatuses.project_id, projectId)
    ),
  });

  if (!status) {
    return { error: NextResponse.json({ error: 'Task status not found' }, { status: 404 }) };
  }

  return { status };
}

/**
 * Moves tasks from one status to another
 * @param tx Transaction object
 * @param projectId Project ID
 * @param fromStatusKey Source status key
 * @param toStatusKey Target status key
 */
export async function moveTasksToStatus(
  tx: { update: typeof db.update },
  projectId: string,
  fromStatusKey: string,
  toStatusKey: string
) {
  // Map the custom status key to the most appropriate enum value for backward compatibility
  let statusEnumValue: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'DONE' = 'BACKLOG';

  // If the status key is one of the enum values, use it directly
  if (['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'].includes(toStatusKey)) {
    statusEnumValue = toStatusKey as 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'DONE';
  } else {
    // Otherwise, map to the most appropriate enum value based on semantic meaning
    const lowerKey = toStatusKey.toLowerCase();

    if (lowerKey.includes('done') || lowerKey.includes('complete') ||
        lowerKey.includes('finish') || lowerKey.includes('closed')) {
      statusEnumValue = 'DONE';
    } else if (lowerKey.includes('progress') || lowerKey.includes('doing') ||
               lowerKey.includes('working') || lowerKey.includes('develop') ||
               lowerKey.includes('implement') || lowerKey.includes('coding') ||
               lowerKey.includes('testing') || lowerKey.includes('review')) {
      statusEnumValue = 'IN_PROGRESS';
    } else if (lowerKey.includes('todo') || lowerKey.includes('planned') ||
               lowerKey.includes('next') || lowerKey.includes('ready')) {
      statusEnumValue = 'TODO';
    } else {
      // Default to BACKLOG for anything else
      statusEnumValue = 'BACKLOG';
    }
  }

  await tx.update(tasks)
    .set({
      status: statusEnumValue,
      status_key: toStatusKey
    })
    .where(and(
      eq(tasks.project_id, projectId),
      eq(tasks.status_key, fromStatusKey)
    ));
}
