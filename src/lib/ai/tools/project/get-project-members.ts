/**
 * Get Project Members Tool
 * This tool allows the AI to get the members of a project
 */

import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";

/**
 * Get the members of a project
 * @param projectId - The ID of the project
 * @returns The members of the project
 */
export async function getProjectMembers(projectId: string) {
  try {
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    // Get member records from the database
    const memberRecords = await db.select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));

    if (memberRecords.length === 0) {
      return {
        success: true,
        message: "Project has no members",
        members: []
      };
    }

    // Get user details from Supabase
    const supabase = await createClient();
    const userIds = memberRecords.map(record => record.userId);

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

    // Map user details to members
    const members = memberRecords.map(record => {
      const user = userDetails[record.userId] || {};
      return {
        id: record.id,
        userId: record.userId,
        projectId: record.projectId,
        role: record.role,
        name: user.name || 'Unknown User',
        email: user.email,
        avatarUrl: user.avatarUrl
      };
    });

    return {
      success: true,
      message: `Found ${members.length} members for this project`,
      members
    };
  } catch (error) {
    console.error("Error getting project members:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to get project members"
    };
  }
}

/**
 * Create a tool for getting project members
 * @param projectId - The ID of the project
 * @returns The get project members tool
 */
export function getProjectMembersTool(projectId: string) {
  return {
    name: "get_project_members",
    description: "Get the members of a project. Returns a list of users who are members of the project.",
    func: async () => {
      try {
        const result = await getProjectMembers(projectId);
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
