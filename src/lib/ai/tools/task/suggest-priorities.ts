/**
 * Suggest Task Priorities Tool
 * This tool allows the AI to suggest priorities for tasks based on their content and context
 */

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { ChatGroq } from "@langchain/groq";
import { groqRateLimiter } from "../../utils/rate-limiter";

/**
 * Suggest priorities for tasks
 * @param projectId - The ID of the project
 * @param taskIds - Optional array of task IDs to prioritize (if not provided, all tasks without priorities will be processed)
 * @returns The suggested priorities
 */
export async function suggestTaskPriorities(projectId: string, taskIds?: string[]) {
  try {
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    // Build the query to get tasks
    const conditions = [eq(tasks.project_id, projectId)];

    // If specific task IDs are provided, filter by them
    if (taskIds && taskIds.length > 0) {
      conditions.push(inArray(tasks.id, taskIds));
    }

    // Get the tasks
    // @ts-ignore Drizzle type issue with dynamic conditions array
    const tasksToProcess = await db.select().from(tasks).where(and(...conditions));

    if (tasksToProcess.length === 0) {
      return {
        success: true,
        message: "No tasks found to process",
        suggestions: []
      };
    }

    // Create a model for suggesting priorities
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY!,
      model: "llama3-8b-8192", // Use a smaller model for this task
      temperature: 0.2,
      maxTokens: 500,
    });

    // Process tasks in batches to avoid rate limits
    const batchSize = 5;
    const suggestions = [];

    for (let i = 0; i < tasksToProcess.length; i += batchSize) {
      const batch = tasksToProcess.slice(i, i + batchSize);
      
      // Process each task in the batch
      const batchSuggestions = await Promise.all(batch.map(async (task) => {
        return groqRateLimiter.enqueue(async () => {
          try {
            // Create a prompt for suggesting priority
            const prompt = `
              Analyze this task and suggest an appropriate priority level (LOW, MEDIUM, HIGH, or URGENT).
              
              Task Title: ${task.title}
              Task Description: ${task.description || "No description provided"}
              Current Status: ${task.status_key || task.status}
              
              Consider the following guidelines:
              - URGENT: Critical tasks that require immediate attention and are blocking other work
              - HIGH: Important tasks that should be completed soon but aren't blocking
              - MEDIUM: Standard tasks with normal importance
              - LOW: Tasks that can be deferred or have minimal impact
              
              Return only the priority level as a single word: LOW, MEDIUM, HIGH, or URGENT.
            `;

            // Get the suggestion
            const response = await model.invoke(prompt);
            const content = (response.content as string).trim().toUpperCase();
            
            // Validate the response
            let priority = "MEDIUM"; // Default
            if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(content)) {
              priority = content;
            }

            return {
              taskId: task.id,
              title: task.title,
              currentPriority: task.priority,
              suggestedPriority: priority,
              reasoning: `Based on the task content and status (${task.status_key || task.status})`
            };
          } catch (error) {
            console.error(`Error suggesting priority for task ${task.id}:`, error);
            return {
              taskId: task.id,
              title: task.title,
              currentPriority: task.priority,
              suggestedPriority: task.priority || "MEDIUM",
              reasoning: "Error occurred during analysis, keeping current priority"
            };
          }
        });
      }));

      suggestions.push(...batchSuggestions);
    }

    return {
      success: true,
      message: `Generated priority suggestions for ${suggestions.length} tasks`,
      suggestions
    };
  } catch (error) {
    console.error("Error suggesting task priorities:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to suggest task priorities"
    };
  }
}

/**
 * Create a tool for suggesting task priorities
 * @param projectId - The ID of the project
 * @returns The suggest task priorities tool
 */
export function suggestTaskPrioritiesTool(projectId: string) {
  return {
    name: "suggest_task_priorities",
    description: "Suggest appropriate priorities for tasks based on their content and context. Optionally provide specific task IDs to analyze.",
    func: async (params: { taskIds?: string[] }) => {
      try {
        const result = await suggestTaskPriorities(projectId, params.taskIds);
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
