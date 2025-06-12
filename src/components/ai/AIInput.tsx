/**
 * AI Input Component
 * This component renders the input field for the AI chat
 */

import { memo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SheetFooter } from "@/components/ui/sheet";
import { PlusCircle, Send, Loader2, Wand2, Sparkles } from "lucide-react";
import { Project } from "./types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface AIInputProps {
  input: string;
  setInput: (input: string) => void;
  isTyping: boolean;
  onSendMessage: (e?: React.FormEvent) => Promise<void>;
  onCreateTask: (taskDescription?: string) => Promise<any>;
  onPerformAction: () => Promise<any>;
  project: Project | null;
  isProcessing?: Record<string, boolean>;
}

// Use memo to prevent unnecessary re-renders
export const AIInput = memo(function AIInput({
  input,
  setInput,
  isTyping,
  onSendMessage,
  onCreateTask,
  onPerformAction,
  project,
  isProcessing = {}
}: AIInputProps) {
  const isCreatingTask = isProcessing['createTask'];
  const isPerformingAction = isProcessing['performAction'];
  const isDisabled = !input.trim() || isTyping || !project?.id || isCreatingTask || isPerformingAction;
  // const canType = project?.id !== undefined; // Removed as it was unused
  const [isFocused, setIsFocused] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle placeholder animation
  useEffect(() => {
    if (input.trim()) {
      setShowPlaceholder(false);
    } else {
      const timer = setTimeout(() => setShowPlaceholder(true), 300);
      return () => clearTimeout(timer);
    }
  }, [input]);

  // Auto-resize textarea
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Force width to be fixed to parent width
      const parentWidth = textarea.parentElement?.clientWidth;
      if (parentWidth) {
        textarea.style.width = `${parentWidth - 32}px`; // Account for padding
      }

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';

      // Set max height based on screen size
      const maxHeight = window.innerWidth < 640 ? 100 : 150;
      // Set the height to scrollHeight (content height) with a max height
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Resize on input change
  useEffect(() => {
    resizeTextarea();
  }, [input]);

  // Resize on window resize
  useEffect(() => {
    window.addEventListener('resize', resizeTextarea);
    return () => window.removeEventListener('resize', resizeTextarea);
  }, []);

  // Handle key press for Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Only send if not disabled (not typing, has content, etc.)
      if (!isDisabled) {
        onSendMessage();
      }
    }
  };

  return (
    <SheetFooter className="sticky bottom-0 px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 border-t z-10 bg-white dark:bg-background w-full">
      <form onSubmit={onSendMessage} className="flex w-full items-start space-x-2">
        <div className="flex-1 relative">
          <div
            className={cn(
              "relative rounded-md transition-all duration-200 overflow-hidden w-full",
              isFocused ? "ring-2 ring-green-300/50" : "ring-1 ring-border/50",
              isTyping && "opacity-80"
            )}
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Immediate resize on input
                setTimeout(resizeTextarea, 0);
              }}
              onFocus={() => {
                setIsFocused(true);
                // Ensure proper sizing when focused
                setTimeout(resizeTextarea, 0);
              }}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              onInput={() => resizeTextarea()}
              placeholder=""
              className="border-0 shadow-none focus-visible:ring-0 rounded-md pl-2.5 sm:pl-3 pr-12 sm:pr-16 min-h-[36px] sm:min-h-[40px] max-h-[100px] sm:max-h-[150px] bg-transparent resize-none overflow-y-auto w-full overflow-x-hidden whitespace-pre-wrap break-words text-sm sm:text-base"
              autoComplete="off"
              disabled={!project?.id}
              rows={1}
            />

            <AnimatePresence>
              {showPlaceholder && !input.trim() && (
                <motion.div
                  className="absolute left-3 top-[10px] flex items-center text-muted-foreground pointer-events-none"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5 text-green-700 dark:text-green-500" />
                  <span className="text-xs sm:text-sm">Ask Mate anything...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {project?.id && input.trim() && (
            <div className="absolute right-1.5 sm:right-2 top-2 flex gap-0.5 sm:gap-1">
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-7 sm:w-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors duration-200"
                      onClick={() => onCreateTask(input)}
                      disabled={isCreatingTask}
                    >
                      <PlusCircle className={cn(
                        "h-3 w-3 sm:h-3.5 sm:w-3.5",
                        isCreatingTask ? "text-muted-foreground animate-pulse" : "text-green-700 dark:text-green-500"
                      )} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-medium">
                    Create task from this message
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-7 sm:w-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors duration-200"
                      onClick={onPerformAction}
                      disabled={isPerformingAction}
                    >
                      <Wand2 className={cn(
                        "h-3 w-3 sm:h-3.5 sm:w-3.5",
                        isPerformingAction ? "text-muted-foreground animate-pulse" : "text-green-700 dark:text-green-500"
                      )} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-medium">
                    Perform AI action
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={isDisabled}
          className={cn(
            "rounded-full h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 p-0 transition-all duration-300 self-end mb-1",
            isDisabled ? "bg-muted text-muted-foreground" : "bg-green-700 hover:bg-green-800 text-white shadow-md hover:shadow-lg dark:bg-green-700 dark:hover:bg-green-800"
          )}
        >
          {isTyping ? (
            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          )}
        </Button>
      </form>
    </SheetFooter>
  );
});
