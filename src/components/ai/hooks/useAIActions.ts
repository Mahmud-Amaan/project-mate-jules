/**
 * AI Actions Hook
 * This hook provides optimized functions for performing AI actions
 */

import { useState } from "react";
import { toast } from "sonner";
import { createTaskViaAI, performAIAction, createColumnViaAI } from "@/actions/ai/actions";
import { useAIStore } from "@/store/aiStore";
// performOptimizedAction was removed as it was unused

export function useAIActions(projectId: string | undefined) {
  const { addMessage, setPendingAction } = useAIStore();
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  /**
   * Handle API response with toast notifications
   * @param promise - Promise to handle
   * @param loadingMessage - Loading message to display
   * @param successMessage - Success message to display
   * @param errorMessage - Error message to display
   * @returns Result of the promise
   */
  const handleApiWithToast = async <T,>(
    actionType: string,
    promise: Promise<T>,
    loadingMessage: string,
    successMessage: string,
    errorMessage: string
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    if (!projectId) {
      return { success: false, error: "No project selected" };
    }

    // Set processing state
    setIsProcessing(prev => ({ ...prev, [actionType]: true }));

    // Show loading toast
    const toastId = toast.loading(loadingMessage);

    try {
      const result = await promise;
      toast.dismiss(toastId);
      toast.success(successMessage);

      // Add AI response to state if result has a message property
      if (result && typeof result === 'object' && 'message' in result) {
        addMessage(projectId, {
          role: "assistant",
          content: result.message,
          timestamp: new Date(),
        });
      }

      return { success: true, data: result };
    } catch (error) {
      toast.dismiss(toastId);
      console.error(errorMessage, error);
      toast.error(errorMessage);

      // Add error message
      addMessage(projectId, {
        role: "assistant",
        content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    } finally {
      // Clear processing state
      setIsProcessing(prev => ({ ...prev, [actionType]: false }));
    }
  };

  // Create a task via AI
  const createTask = async (taskDescription: string) => {
    return handleApiWithToast(
      'createTask',
      createTaskViaAI(projectId!, taskDescription),
      "Creating task...",
      "Task created successfully!",
      "Failed to create task. Please try again."
    );
  };

  // Create multiple tasks via AI
  const createMultipleTasks = async (taskDescription: string) => {
    if (!projectId) return { success: false, error: "No project selected" };

    try {
      // Check if the request is for multiple tasks
      const isMultipleTasks = (
        taskDescription.toLowerCase().includes("tasks") ||
        taskDescription.toLowerCase().includes("multiple") ||
        taskDescription.match(/\d+\s+tasks/) // e.g., "3 tasks"
      );

      if (isMultipleTasks) {
        // Extract number of tasks if specified
        const numTasksMatch = taskDescription.match(/(\d+)\s+tasks?/);
        const numTasks = numTasksMatch ? parseInt(numTasksMatch[1]) : 3; // Default to 3 if not specified

        // Show loading state
        toast.loading(`Creating ${numTasks} tasks...`);

        // Add AI thinking message
        addMessage(projectId, {
          role: "assistant",
          content: `I'm creating ${numTasks} tasks based on your request. Please wait...`,
          timestamp: new Date(),
        });

        // Create tasks one by one
        const tasksCreated = [];
        let errorOccurred = false;
        const newColumns = new Set();

        // First, create a task with the full context to potentially create a new column
        try {
          const firstResult = await createTaskViaAI(projectId,
            `This is the first task for: ${taskDescription}. Create an appropriate column if needed and make this task specific and detailed.`
          );

          if ('error' in firstResult && firstResult.error) {
            errorOccurred = true;
          } else {
            tasksCreated.push(firstResult.task);

            // Track any new column that was created
            if (firstResult.newColumn) {
              newColumns.add(firstResult.newColumn);
            }
          }
        } catch (error) {
          console.error(`Error creating first task:`, error);
          errorOccurred = true;
        }

        // Create the remaining tasks in parallel with a limit of 3 concurrent requests
        const remainingTaskPromises = [];
        for (let i = 1; i < numTasks; i++) {
          const promise = createTaskViaAI(projectId,
            `This is task ${i+1} of ${numTasks} for: ${taskDescription}. Make this task specific and detailed.`
          ).then(result => {
            if ('error' in result && result.error) {
              return null;
            }

            // Track any new column that was created
            if (result.newColumn) {
              newColumns.add(result.newColumn);
            }

            return result.task;
          }).catch(error => {
            console.error(`Error creating task ${i+1}:`, error);
            return null;
          });

          remainingTaskPromises.push(promise);
        }

        // Process tasks in batches of 3
        for (let i = 0; i < remainingTaskPromises.length; i += 3) {
          const batch = remainingTaskPromises.slice(i, i + 3);
          const results = await Promise.all(batch);

          // Add successful tasks to the list
          results.forEach(task => {
            if (task) {
              tasksCreated.push(task);
            } else {
              errorOccurred = true;
            }
          });
        }

        // Show results
        if (tasksCreated.length > 0) {
          // Success message
          toast.success(`Created ${tasksCreated.length} tasks successfully!`);

          // Add information about new columns if any were created
          let columnMessage = "";
          if (newColumns.size > 0) {
            columnMessage = `I've created ${newColumns.size === 1 ? "a new column" : `${newColumns.size} new columns`}: ${Array.from(newColumns).join(", ")}\n\n`;
          }

          // Add AI response with task details
          const taskListMessage = `${columnMessage}I've created ${tasksCreated.length} tasks for you:\n\n` +
            tasksCreated.map((task, index) => {
              if (!task) return `**Task ${index+1}: Not created**\n`;
              return `**Task ${index+1}: ${task.title}**\n` +
                `* Status: ${task.status}\n` +
                `* Priority: ${task.priority}\n` +
                `* Description: ${task.description}\n`;
            }).join('\n');

          addMessage(projectId, {
            role: "assistant",
            content: taskListMessage,
            timestamp: new Date(),
          });

          return { success: true, tasksCreated, newColumns: Array.from(newColumns) };
        }

        if (errorOccurred) {
          toast.error("Some tasks could not be created. Please try again.");
          return { success: false, error: "Some tasks could not be created" };
        }
      } else {
        // Single task creation
        return createTask(taskDescription);
      }
    } catch (error) {
      console.error("Error creating tasks:", error);
      toast.error("Failed to create tasks. Please try again.");

      // Add error message
      addMessage(projectId, {
        role: "assistant",
        content: "I'm sorry, I encountered an error creating the tasks. Please try again.",
        timestamp: new Date(),
      });

      return { success: false, error: "Failed to create tasks" };
    }
  };

  // Create a column via AI
  const createColumn = async (columnName: string, columnColor: string = "blue") => {
    return handleApiWithToast(
      'createColumn',
      createColumnViaAI(projectId!, `Create a column named "${columnName}" with color ${columnColor}`),
      "Creating column...",
      "Column created successfully!",
      "Failed to create column. Please try again."
    );
  };

  // Delete a task via AI
  const deleteTask = async (taskIdentifier: string) => {
    if (!projectId) return { success: false, error: "No project selected" };

    try {
      // Show loading state
      toast.loading("Analyzing tasks...");

      // Check if this is a domain-specific request
      const isDomainSpecific = (
        taskIdentifier.includes("related") ||
        taskIdentifier.includes("stuff") ||
        taskIdentifier.includes("things") ||
        taskIdentifier.includes("all") ||
        taskIdentifier.includes("everything")
      );

      // First, preview the task(s) to be deleted
      const previewResult = await performAIAction(projectId, `Preview delete task: ${taskIdentifier}`);

      if ('error' in previewResult && previewResult.error) {
        toast.error(previewResult.error);
        return { success: false, error: previewResult.error, needsConfirmation: false };
      }

      // If we're deleting useless tasks or domain-specific tasks, show a preview first
      if (taskIdentifier.toLowerCase().includes("useless") || isDomainSpecific) {
        // Add AI response with preview
        addMessage(projectId, {
          role: "assistant",
          content: ('message' in previewResult && previewResult.message) || "I've identified some tasks that match your criteria. Would you like me to delete them?",
          timestamp: new Date(),
        });

        // Store the pending action for confirmation
        setPendingAction({
          type: "DELETE_TASK",
          parameters: { taskDescription: taskIdentifier },
          needsConfirmation: true
        });

        // Clear loading state
        toast.dismiss();
        return {
          success: true,
          needsConfirmation: true,
          message: ('message' in previewResult && previewResult.message) || "Tasks identified for deletion",
          taskDescription: taskIdentifier
        };
      }

      // For specific task deletion, proceed with deletion
      return handleApiWithToast(
        'deleteTask',
        performAIAction(projectId, `Delete task: ${taskIdentifier}`),
        "Deleting task...",
        "Task deleted successfully!",
        "Failed to delete task. Please try again."
      );
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task. Please try again.");

      // Add error message
      addMessage(projectId, {
        role: "assistant",
        content: "I'm sorry, I encountered an error deleting the task. Please try again.",
        timestamp: new Date(),
      });

      return { success: false, error: "Failed to delete task" };
    }
  };

  // Delete a column via AI
  const deleteColumn = async (columnIdentifier: string) => {
    return handleApiWithToast(
      'deleteColumn',
      performAIAction(projectId!, `Delete column: ${columnIdentifier}`),
      "Deleting column...",
      "Column deleted successfully!",
      "Failed to delete column. Please try again."
    );
  };

  // Add solutions to tasks via AI
  const addSolutionsToTasks = async () => {
    return handleApiWithToast(
      'addSolutionsToTasks',
      performAIAction(projectId!, "Update tasks with solutions"),
      "Analyzing tasks and generating solutions...",
      "Tasks updated with solutions!",
      "Failed to add solutions to tasks. Please try again."
    );
  };

  // Perform a generic AI action
  const performAction = async (actionDescription: string) => {
    return handleApiWithToast(
      'performAction',
      performAIAction(projectId!, actionDescription),
      "Performing action...",
      "Action completed successfully!",
      "Failed to perform action. Please try again."
    );
  };

  // Generate suggestions via AI
  const generateSuggestions = async () => {
    if (!projectId) return { success: false, error: "No project selected" };

    // Default suggestions to use as fallback
    const defaultSuggestions = [
      "Create 3 tasks for implementing user authentication",
      "Move all in-progress tasks to done",
      "Create a new column for code review",
      "What tasks are currently in the backlog?",
      "Set due dates for all high priority tasks",
      "Suggest a project structure for this app",
    ];

    try {
      // Get project-specific suggestions
      const result = await performAIAction(
        projectId,
        "Generate 6 short, specific suggestions for prompts that would be helpful for this project. Each suggestion should be a single sentence and focus on technical aspects. Return ONLY the list of suggestions separated by '|' characters with no additional text."
      );

      if ('success' in result && result.success && 'message' in result && result.message) {
        // Parse the suggestions
        const newSuggestions = result.message
          .split('|')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);

        // Return suggestions if we got valid ones
        if (newSuggestions.length >= 3) {
          return { success: true, suggestions: newSuggestions.slice(0, 6) };
        }
      }

      return {
        success: false,
        error: "Failed to generate suggestions",
        suggestions: defaultSuggestions
      };
    } catch (error) {
      console.error("Error getting suggestions:", error);
      return {
        success: false,
        error: "Failed to generate suggestions",
        suggestions: defaultSuggestions
      };
    }
  };

  return {
    createTask,
    createMultipleTasks,
    createColumn,
    deleteTask,
    deleteColumn,
    addSolutionsToTasks,
    performAction,
    generateSuggestions,
    isProcessing,
  };
}
