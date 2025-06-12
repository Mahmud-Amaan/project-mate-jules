/**
 * AI Messages Hook
 * This hook provides functions for managing AI messages
 */

import { useState, useEffect, useRef } from "react";
import { useAIStore } from "@/store/aiStore";
import { performAIAction } from "@/actions/ai/actions";
// PendingAction was removed as it was unused

export function useAIMessages(projectId: string | undefined, open: boolean) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const {
    // messages: storedMessages, // Removed as it was unused
    isTyping,
    setIsTyping,
    addMessage,
    pendingAction,
    setPendingAction,
    getProjectMessages
  } = useAIStore();

  const projectMessages = projectId ? getProjectMessages(projectId) : [];

  // Scroll to bottom when new messages arrive or typing state changes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        // Use requestAnimationFrame to ensure the DOM has updated
        requestAnimationFrame(() => {
          scrollArea.scrollTop = scrollArea.scrollHeight;
        });
      }
    }
  }, [projectMessages, isTyping]);

  // Initialize with welcome message if no messages exist
  useEffect(() => {
    if (open && projectId && projectMessages.length === 0) {
      // Initial welcome message
      setIsTyping(true);

      // Simulate typing delay
      const timeoutId = setTimeout(async () => {
        try {
          // Call server action to get a personalized welcome message
          const result = await performAIAction(projectId, "Introduce yourself as Mate, the AI project assistant, and provide a brief overview of what you can do to help with this specific project. Be concise but informative.");

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
  }, [open, projectId, projectMessages.length, addMessage, setIsTyping]);

  // Add a user message
  const addUserMessage = (message: string) => {
    if (!projectId) return;

    addMessage(projectId, {
      role: "user",
      content: message,
      timestamp: new Date(),
    });
  };

  // Add an assistant message
  const addAssistantMessage = (message: string) => {
    if (!projectId) return;

    addMessage(projectId, {
      role: "assistant",
      content: message,
      timestamp: new Date(),
    });
  };

  return {
    input,
    setInput,
    pendingAction,
    setPendingAction,
    scrollAreaRef,
    isTyping,
    setIsTyping,
    projectMessages,
    addUserMessage,
    addAssistantMessage,
  };
}
