/**
 * Optimized AI Hook
 * This hook provides functions for interacting with the optimized AI assistant
 */

import { useState, useEffect, useCallback } from "react";
import { useAIStore } from "@/store/aiStore";
import {
  sendOptimizedMessage,
  performOptimizedAction,
  initializeProjectContext
} from "@/lib/ai/client/optimized-client";
import { toast } from "sonner";

export function useOptimizedAI(projectId: string | undefined, open: boolean) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  const {
    // messages: storedMessages, // Removed as it was unused
    addMessage,
    getProjectMessages
  } = useAIStore();

  // Get messages for the current project
  const projectMessages = projectId ? getProjectMessages(projectId) : [];

  // Initialize AI context when the component mounts or project changes
  useEffect(() => {
    if (open && projectId && !isInitialized) {
      const initializeContext = async () => {
        try {
          const success = await initializeProjectContext(projectId);
          setIsInitialized(success);
        } catch (error) {
          console.error("Error initializing AI context:", error);
        }
      };

      initializeContext();
    }
  }, [open, projectId, isInitialized]);

  // Initialize with welcome message if no messages exist
  useEffect(() => {
    if (open && projectId && projectMessages.length === 0) {
      // Initial welcome message
      setIsTyping(true);

      // Simulate typing delay
      const timeoutId = setTimeout(async () => {
        try {
          // Send a welcome message request
          const result = await sendOptimizedMessage(
            projectId,
            "Introduce yourself as Mate, the AI project assistant, and provide a brief overview of what you can do to help with this specific project. Be concise but informative."
          );

          if ('error' in result && result.error) {
            // Fallback message if there's an error
            addMessage(projectId, {
              role: "assistant",
              content: `Hello! I'm Mate, your AI project assistant. I'm here to help with your project.

I can help you with:
- Creating technical tasks
- Suggesting implementation approaches
- Providing code guidance
- Planning project architecture
- Answering development questions

How can I assist you today?`,
              timestamp: new Date(),
            });
          } else {
            // Use the AI-generated welcome message
            addMessage(projectId, {
              role: "assistant",
              content: ('message' in result && result.message) ? result.message : 'Hello! I\'m Mate, your AI project assistant.',
              timestamp: new Date(),
            });
          }
        } catch (error) {
          // Fallback message if there's an error
          addMessage(projectId, {
            role: "assistant",
            content: `Hello! I'm Mate, your AI project assistant. I'm here to help with your project.

I can help you with:
- Creating technical tasks
- Suggesting implementation approaches
- Providing code guidance
- Planning project architecture
- Answering development questions

How can I assist you today?`,
            timestamp: new Date(),
          });
          console.error("Error getting welcome message:", error);
        } finally {
          setIsTyping(false);
        }
      }, 1000);

      // Clean up timeout on unmount
      return () => clearTimeout(timeoutId);
    }
  }, [open, projectId, projectMessages.length, addMessage]);

  // Add a user message
  const addUserMessage = useCallback((message: string) => {
    if (!projectId) return;

    addMessage(projectId, {
      role: "user",
      content: message,
      timestamp: new Date(),
    });
  }, [projectId, addMessage]);

  // Add an assistant message
  const addAssistantMessage = useCallback((message: string) => {
    if (!projectId) return;

    addMessage(projectId, {
      role: "assistant",
      content: message,
      timestamp: new Date(),
    });
  }, [projectId, addMessage]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!projectId || !input.trim() || isTyping) return;

    const currentInput = input.trim();
    setInput("");
    addUserMessage(currentInput);
    setIsTyping(true);

    try {
      // Send the message to the AI
      const response = await sendOptimizedMessage(projectId, currentInput);

      // Add AI response to state
      addAssistantMessage(response.message);
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast.error("Failed to get AI response. Please try again.");

      // Add error message
      addAssistantMessage("I'm sorry, I encountered an error processing your request. Please try again.");
    } finally {
      setIsTyping(false);
    }
  }, [projectId, input, isTyping, addUserMessage, addAssistantMessage]);

  // Handle creating a task
  const handleCreateTask = useCallback(async (taskDescription: string) => {
    if (!projectId) return;

    setIsProcessing(prev => ({ ...prev, createTask: true }));

    try {
      // Send the task creation request
      const response = await performOptimizedAction(
        projectId,
        `Create a task with this description: ${taskDescription}`
      );

      // Add AI response to state
      addAssistantMessage(response.message);

      return { success: !response.error };
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task. Please try again.");

      // Add error message
      addAssistantMessage("I'm sorry, I encountered an error creating the task. Please try again.");

      return { success: false, error: "Failed to create task" };
    } finally {
      setIsProcessing(prev => ({ ...prev, createTask: false }));
    }
  }, [projectId, addAssistantMessage]);

  // Handle creating multiple tasks
  const handleCreateMultipleTasks = useCallback(async (taskDescription: string) => {
    if (!projectId) return;

    setIsProcessing(prev => ({ ...prev, createMultipleTasks: true }));

    try {
      // Send the multiple task creation request
      const response = await performOptimizedAction(
        projectId,
        `Create multiple tasks based on this description: ${taskDescription}`
      );

      // Add AI response to state
      addAssistantMessage(response.message);

      return { success: !response.error };
    } catch (error) {
      console.error("Error creating multiple tasks:", error);
      toast.error("Failed to create tasks. Please try again.");

      // Add error message
      addAssistantMessage("I'm sorry, I encountered an error creating the tasks. Please try again.");

      return { success: false, error: "Failed to create tasks" };
    } finally {
      setIsProcessing(prev => ({ ...prev, createMultipleTasks: false }));
    }
  }, [projectId, addAssistantMessage]);

  // Handle creating a column
  const handleCreateColumn = useCallback(async (columnName: string, columnColor: string = "blue") => {
    if (!projectId) return;

    setIsProcessing(prev => ({ ...prev, createColumn: true }));

    try {
      // Send the column creation request
      const response = await performOptimizedAction(
        projectId,
        `Create a column named "${columnName}" with color ${columnColor}`
      );

      // Add AI response to state
      addAssistantMessage(response.message);

      return { success: !response.error };
    } catch (error) {
      console.error("Error creating column:", error);
      toast.error("Failed to create column. Please try again.");

      // Add error message
      addAssistantMessage("I'm sorry, I encountered an error creating the column. Please try again.");

      return { success: false, error: "Failed to create column" };
    } finally {
      setIsProcessing(prev => ({ ...prev, createColumn: false }));
    }
  }, [projectId, addAssistantMessage]);

  // Handle deleting a task
  const handleDeleteTask = useCallback(async (taskIdentifier: string) => {
    if (!projectId) return;

    setIsProcessing(prev => ({ ...prev, deleteTask: true }));

    try {
      // Send the task deletion request
      const response = await performOptimizedAction(
        projectId,
        `Delete the task ${taskIdentifier}`
      );

      // Add AI response to state
      addAssistantMessage(response.message);

      return { success: !response.error };
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task. Please try again.");

      // Add error message
      addAssistantMessage("I'm sorry, I encountered an error deleting the task. Please try again.");

      return { success: false, error: "Failed to delete task" };
    } finally {
      setIsProcessing(prev => ({ ...prev, deleteTask: false }));
    }
  }, [projectId, addAssistantMessage]);

  // Handle deleting a column
  const handleDeleteColumn = useCallback(async (columnIdentifier: string) => {
    if (!projectId) return;

    setIsProcessing(prev => ({ ...prev, deleteColumn: true }));

    try {
      // Send the column deletion request
      const response = await performOptimizedAction(
        projectId,
        `Delete the column ${columnIdentifier}`
      );

      // Add AI response to state
      addAssistantMessage(response.message);

      return { success: !response.error };
    } catch (error) {
      console.error("Error deleting column:", error);
      toast.error("Failed to delete column. Please try again.");

      // Add error message
      addAssistantMessage("I'm sorry, I encountered an error deleting the column. Please try again.");

      return { success: false, error: "Failed to delete column" };
    } finally {
      setIsProcessing(prev => ({ ...prev, deleteColumn: false }));
    }
  }, [projectId, addAssistantMessage]);

  // Handle performing a general action
  const handlePerformAction = useCallback(async (action?: string) => {
    if (!projectId || (!input.trim() && !action)) return;

    setIsProcessing(prev => ({ ...prev, performAction: true }));

    try {
      // Send the action request
      const response = await performOptimizedAction(
        projectId,
        action || input
      );

      // Add AI response to state
      addAssistantMessage(response.message);

      if (!response.error) {
        setInput("");
      }

      return { success: !response.error };
    } catch (error) {
      console.error("Error performing action:", error);
      toast.error("Failed to perform action. Please try again.");

      // Add error message
      addAssistantMessage("I'm sorry, I encountered an error performing this action. Please try again.");

      return { success: false, error: "Failed to perform action" };
    } finally {
      setIsProcessing(prev => ({ ...prev, performAction: false }));
    }
  }, [projectId, input, addAssistantMessage]);

  // Generate suggestions for the AI using static suggestions
  const handleGenerateSuggestions = useCallback(async () => {
    if (!projectId) return { success: false, suggestions: [] };

    try {
      // Import static suggestions
      const { getProjectSpecificSuggestions, getRandomSuggestions } = await import('@/lib/ai/suggestions/static-suggestions');

      // Get project details if available
      let projectName = '';
      let projectDescription = '';

      try {
        // Try to fetch project details from the API
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const projectData = await response.json();
          projectName = projectData.name || '';
          projectDescription = projectData.description || '';
        }
      } catch (error) {
        console.error("Error fetching project details for suggestions:", error);
      }

      // Get project-specific suggestions if we have project details
      let suggestions: string[] = [];
      if (projectName || projectDescription) {
        suggestions = getProjectSpecificSuggestions(projectName, projectDescription, 4);
      } else {
        // Otherwise use random suggestions
        suggestions = getRandomSuggestions(4);
      }

      return { success: true, suggestions };
    } catch (error) {
      console.error("Error generating suggestions:", error);

      // Return fallback suggestions
      return {
        success: false,
        suggestions: [
          "Create a task for implementing user authentication",
          "Add a new column for code review",
          "What tasks are currently in the backlog?",
          "Help me plan the next sprint"
        ]
      };
    }
  }, [projectId]);

  return {
    input,
    setInput,
    pendingAction,
    setPendingAction,
    isTyping,
    setIsTyping,
    projectMessages,
    addUserMessage,
    addAssistantMessage,
    isProcessing,
    isInitialized,

    // Actions
    sendMessage: handleSendMessage,
    createTask: handleCreateTask,
    createMultipleTasks: handleCreateMultipleTasks,
    createColumn: handleCreateColumn,
    deleteTask: handleDeleteTask,
    deleteColumn: handleDeleteColumn,
    performAction: handlePerformAction,
    generateSuggestions: handleGenerateSuggestions,
  };
}
