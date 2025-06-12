"use client";

/**
 * AI Assistant
 * This component provides an optimized AI assistant interface
 * with better performance, user experience, and features
 */

import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useOptimizedAI } from "./hooks/useOptimizedAI";
import { AIHeader } from "./AIHeader";
import { AIChat } from "./AIChat";
import { AIInput } from "./AIInput";
import { AISuggestions } from "./AISuggestions";
import { AIConfirmation } from "./AIConfirmation";
// ScrollArea was removed as it was unused
import { useProject } from "@/hooks/useProject";

interface AIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

export function AIAssistant({
  open,
  onOpenChange,
  projectId,
}: AIAssistantProps) {
  // Use the project hook with fallback for loading state
  // isLoading was removed as it was unused
  const { project } = useProject(projectId);

  // Create a minimal project object if project is null or loading
  const safeProject = project || (projectId ? {
    id: projectId,
    name: "Loading Project...",
    description: "",
    ownerId: ""
  } : null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Use the optimized AI hook
  const {
    input,
    setInput,
    pendingAction,
    setPendingAction,
    isTyping,
    projectMessages,
    isProcessing,

    // Actions
    sendMessage,
    createTask,
    createMultipleTasks,
    performAction,
    generateSuggestions,
  } = useOptimizedAI(projectId, open);

  // Handle sending a message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await sendMessage(e);
  };

  // Handle creating a task
  const handleCreateTask = async (taskDescription?: string) => {
    if (!taskDescription) return;
    return createTask(taskDescription);
  };

  // handleCreateMultipleTasks was removed as it was unused

  // Handle performing an action
  const handlePerformAction = async (action?: string) => {
    return performAction(action);
  };

  // Handle clicking a suggestion
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    handleSendMessage();
  };

  // Handle confirming an action
  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    try {
      switch (pendingAction.type) {
        case "CREATE_TASK":
          await createTask(pendingAction.description);
          break;
        case "CREATE_MULTIPLE_TASKS":
          await createMultipleTasks(pendingAction.description);
          break;
        case "PERFORM_ACTION":
          await performAction(pendingAction.action);
          break;
        default:
          console.error("Unknown action type:", pendingAction.type);
      }
    } catch (error) {
      console.error("Error confirming action:", error);
    } finally {
      setPendingAction(null);
    }
  };

  // Handle canceling an action
  const handleCancelAction = () => {
    setPendingAction(null);
  };

  // Generate suggestions when the component mounts or when the project changes
  useEffect(() => {
    if (open && projectId) {
      const getSuggestions = async () => {
        try {
          // Use the optimized suggestion generator
          const { suggestions } = await generateSuggestions();
          setSuggestions(suggestions);
        } catch (error) {
          console.error("Error generating suggestions:", error);
          // Import static suggestions as fallback
          import('@/lib/ai/suggestions/static-suggestions').then(({ getRandomSuggestions }) => {
            setSuggestions(getRandomSuggestions(4));
          }).catch(() => {
            // Ultimate fallback if even the import fails
            setSuggestions([
              "Create a task for implementing user authentication",
              "Add a new column for code review",
              "What tasks are currently in the backlog?",
              "Help me plan the next sprint"
            ]);
          });
        }
      };

      getSuggestions();
    }
  }, [open, projectId, generateSuggestions]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [projectMessages]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col h-[100dvh] border-l overflow-hidden w-full sm:max-w-md"
      >
        <AIHeader onClose={() => onOpenChange(false)} />

        <AIChat
          messages={projectMessages}
          isTyping={isTyping}
          scrollAreaRef={scrollAreaRef}
        />

        {pendingAction ? (
          <AIConfirmation
            pendingAction={pendingAction}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
            isProcessing={isProcessing[pendingAction.type.toLowerCase()]}
          />
        ) : (
          <AISuggestions
            suggestions={suggestions}
            onSuggestionClick={handleSuggestionClick}
          />
        )}

        <AIInput
          input={input}
          setInput={setInput}
          isTyping={isTyping}
          onSendMessage={handleSendMessage}
          onCreateTask={handleCreateTask}
          onPerformAction={() => handlePerformAction()}
          project={safeProject}
          isProcessing={isProcessing}
        />
      </SheetContent>
    </Sheet>
  );
}

// Also export as default for easier imports
export default AIAssistant;
