/**
 * Get Task Assignees Tool
 * This tool allows the AI to get the assignees of a task
 */

import { db } from "@/db";
import { taskAssignees, authUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";

/**
 * Get the assignees of a task
 * @param taskId - The ID of the task
 * @returns The assignees of the task
 */
export async function getTaskAssignees(taskId: string) {
  try {
    if (!taskId) {
      throw new Error("Task ID is required");
    }

    // Get assignee IDs from the database
    const assigneeRecords = await db.select()
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));

    if (assigneeRecords.length === 0) {
      return {
        success: true,
        message: "Task has no assignees",
        assignees: []
      };
    }

    // Get user details from Supabase
    const supabase = await createClient();
    const userIds = assigneeRecords.map(record => record.userId);

    const userDetails: Record<string, any> = {};

    try {
      // Try to get user profiles first
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (!profilesError && profiles && profiles.length > 0) {
        // Create a map of user details
        profiles.forEach(profile => {
          userDetails[profile.id] = {
            id: profile.id,
            name: profile.full_name,
            email: profile.email,
            avatarUrl: profile.avatar_url
          };
        });
      } else {
        // Fallback to auth users if profiles not available
        const { data: { user } } = await supabase.auth.getUser();

        // For simplicity, we'll just use basic info for now
        userIds.forEach(userId => {
          userDetails[userId] = {
            id: userId,
            name: userId === user?.id ? 'You' : 'Team Member',
            email: null,
            avatarUrl: null
          };
        });
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      // Continue with basic info
    }

    // Map user details to assignees
    const assignees = assigneeRecords.map(record => {
      const user = userDetails[record.userId] || {};
      return {
        id: record.id,
        userId: record.userId,
        taskId: record.taskId,
        name: user.name || 'Unknown User',
        email: user.email,
        avatarUrl: user.avatarUrl
      };
    });

    return {
      success: true,
      message: `Found ${assignees.length} assignees for this task`,
      assignees
    };
  } catch (error) {
    console.error("Error getting task assignees:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to get task assignees"
    };
  }
}

/**
 * Create a tool for getting task assignees
 * @param projectId - The ID of the project (not used directly but kept for consistency)
 * @returns The get task assignees tool
 */
export function getTaskAssigneesTool(projectId: string) {
  return {
    name: "get_task_assignees",
    description: "Get the assignees of a task. Returns a list of users assigned to the task.",
    func: async (params: { taskId: string }) => {
      try {
        const result = await getTaskAssignees(params.taskId);
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  };
}
