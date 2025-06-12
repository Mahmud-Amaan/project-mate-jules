/**
 * AI Message Component
 * This component renders a single message in the AI chat
 */

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Sparkles } from "lucide-react"; // User was removed
import type { AIMessage as AIMessageType } from "@/store/aiStore";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/client";

interface AIMessageProps {
  message: AIMessageType;
}

// Use memo to prevent unnecessary re-renders
export const AIMessage = memo(function AIMessage({ message }: AIMessageProps) {
  const isUser = message.role === "user";
  const [userData, setUserData] = useState<{
    avatarUrl?: string;
    name?: string;
    email?: string;
  }>({});

  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      if (isUser) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setUserData({
            avatarUrl: user.user_metadata.avatar_url,
            name: user.user_metadata.full_name || user.email?.split("@")[0],
            email: user.email
          });
        }
      }
    };

    fetchUserData();
  }, [isUser]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 500, damping: 25 }}
      className={cn(
        "flex mb-4 w-full px-1",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex gap-4 items-start",
          isUser ? "flex-row-reverse max-w-[95%]" : "flex-row max-w-[95%]"
        )}
      >
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 mt-0.5",
          isUser ? "ml-3" : "mr-3"
        )}>
          {!isUser ? (
            <div className="relative h-8 w-8 flex items-center justify-center">
              <div className="absolute -inset-0.5 rounded-full bg-green-300/70 opacity-75 blur-[1px] animate-pulse"></div>
              <div className="relative bg-white dark:bg-background rounded-full p-1.5 shadow-sm h-8 w-8 flex items-center justify-center">
                <Bot className="h-4 w-4 text-green-700 dark:text-green-500" />
              </div>
            </div>
          ) : (
            <Avatar className="h-8 w-8 border border-border shadow-sm">
              <AvatarImage src={userData.avatarUrl} alt={userData.name || "User"} />
              <AvatarFallback className="text-xs bg-background">
                {userData.name ? userData.name.charAt(0).toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Message content */}
        <div className={cn(
          "min-w-0 overflow-hidden break-words",
          isUser ? "max-w-[85%] sm:max-w-[80%] md:max-w-[75%]" : "max-w-[85%] sm:max-w-[80%] md:max-w-[75%]"
        )}>
          <div
            className={cn(
              "rounded-lg px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-sm overflow-hidden w-full break-words",
              !isUser
                ? "bg-white border border-border/50 dark:bg-background dark:border-border/30"
                : "bg-green-700 text-white dark:bg-green-800"
            )}
          >
            {!isUser && message.content.includes("created") && (
              <div className="flex items-center gap-1 mb-1 text-xs text-green-700 dark:text-green-500 font-medium">
                <Sparkles className="h-3 w-3 text-green-700 dark:text-green-500" />
                <span>Action Completed</span>
              </div>
            )}
            <div className={cn(
              "whitespace-pre-wrap text-sm sm:text-base leading-relaxed break-words overflow-hidden w-full",
              isUser ? "max-w-full" : ""
            )}>
              <span className="break-words overflow-hidden">{message.content}</span>
            </div>
          </div>

          {/* Timestamp */}
          <div
            className={cn(
              "text-[10px] text-muted-foreground mt-1",
              isUser ? "text-right" : ""
            )}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
