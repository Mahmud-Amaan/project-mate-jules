'use server'

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { createOptimizedProject } from "@/lib/ai/tools/project-creator/optimized-creator";
import { storeOptimizedMessage } from "@/lib/ai/memory/optimized-memory";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Authentication required' };
  }

  const idea = formData.get('idea') as string;

  if (!idea) {
    return { error: 'Project idea is required' };
  }

  try {
    // Use the optimized project creation function
    try {
      const result = await createOptimizedProject(user.id, idea);

      if (!result || !result.project || !result.project.id) {
        return { error: 'Failed to create project. Please try again with a different description.' };
      }

      // Add the creator as a project member
      await db.insert(projectMembers).values({
        projectId: result.project.id,
        userId: user.id,
        role: 'OWNER',
      });

      console.log(`Created project ${result.project.id} with ${result.columns.length} columns and ${result.taskCount} tasks`);

      // Store additional project information in memory
      await storeOptimizedMessage(
        result.project.id,
        {
          role: "system",
          content: `Project created: ${result.project.name}\n\nDescription: ${result.project.description}\n\nColumns: ${result.columns.map(col => col.name).join(', ')}\n\nTasks: ${result.taskCount} tasks created\n\nThis project has been set up with multiple columns and tasks distributed across them. The AI has created technical tasks based on the project requirements.`,
          timestamp: new Date(),
        }
      );

      return { success: true, projectId: result.project.id };
    } catch (error) {
      console.error('Error creating project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for rate limit errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        return { error: 'AI service rate limit exceeded. Please try again later.' };
      }

      return { error: 'Failed to create project. Please try again with a different description.' };
    }
  } catch (error) {
    console.error('Detailed error in project creation:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}