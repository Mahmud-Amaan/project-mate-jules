"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  X,
  Edit,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Code,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Task, TaskStatus } from "../types";
import DeleteTaskDialog from "./DeleteTaskDialog";
import * as SimpleIcons from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import TechIconPicker from "../components/TechIconPicker";

interface TrelloCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  taskStatuses: TaskStatus[];
}

export default function TrelloCardModal({
  open,
  onOpenChange,
  task,
  onTaskUpdate,
  onTaskDelete,
  taskStatuses,
}: TrelloCardModalProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState(
    task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : ""
  );
  const [selectedPriority, setSelectedPriority] = useState(task.priority || "MEDIUM");
  const [techIcons, setTechIcons] = useState<string[]>(() => {
    // Handle different data types for tech_icons
    if (task.tech_icons) {
      if (Array.isArray(task.tech_icons)) {
        return task.tech_icons;
      } else if (typeof task.tech_icons === 'string') {
        try {
          // Try to parse JSON string
          const parsed = JSON.parse(task.tech_icons);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          // If not valid JSON, treat as a single icon
          return [task.tech_icons];
        }
      }
    } else if (task.tech_icon) {
      // Fallback to legacy tech_icon
      return [task.tech_icon];
    }
    return [];
  });


  const [showIconPicker, setShowIconPicker] = useState(false);
  const [currentTechIcons, setCurrentTechIcons] = useState<{ slug: string; svg: string; title: string }[]>([]);

  // Load tech icons if available
  useEffect(() => {
    if (Array.isArray(techIcons) && techIcons.length > 0) {
      try {
        // Find all icons in SimpleIcons
        const loadedIcons = techIcons.map(slug => {
          const iconKey = Object.keys(SimpleIcons).find(
            (key) =>
              key !== "default" &&
              !key.startsWith("_") &&
              // Cast to SimpleIcon to access slug property
              (SimpleIcons[key as keyof typeof SimpleIcons] as SimpleIcon).slug === slug
          );

          if (iconKey) {
            // Cast to SimpleIcon to access properties
            const icon = SimpleIcons[iconKey as keyof typeof SimpleIcons] as SimpleIcon;
            return { slug, svg: icon.svg, title: icon.title };
          }
          return null;
        }).filter(icon => icon !== null) as { slug: string; svg: string; title: string }[];

        setCurrentTechIcons(loadedIcons);
      } catch (error) {
        console.error("Error loading tech icons:", error);
        setCurrentTechIcons([]);
      }
    } else {
      setCurrentTechIcons([]);
    }
  }, [techIcons]);

  // Handle title update
  const handleTitleUpdate = async () => {
    if (!title.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    try {
      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          title,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task title");
      }

      onTaskUpdate({
        ...task,
        title,
      });

      setIsEditingTitle(false);
    } catch (error) {
      console.error("Error updating task title:", error);
      toast.error("Failed to update title");
    }
  };

  // Handle description update
  const handleDescriptionUpdate = async () => {
    try {
      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task description");
      }

      onTaskUpdate({
        ...task,
        description,
      });

      setIsEditingDescription(false);
    } catch (error) {
      console.error("Error updating task description:", error);
      toast.error("Failed to update description");
    }
  };

  // Handle due date update
  const handleDueDateUpdate = async () => {
    try {
      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          due_date: dueDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update due date");
      }

      onTaskUpdate({
        ...task,
        due_date: dueDate ? new Date(dueDate) : null,
      });
    } catch (error) {
      console.error("Error updating due date:", error);
      toast.error("Failed to update due date");
    }
  };

  // Handle priority update
  const handlePriorityUpdate = async (newPriority: string) => {
    try {
      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          priority: newPriority,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update priority");
      }

      setSelectedPriority(newPriority as Task["priority"]);
      onTaskUpdate({
        ...task,
        priority: newPriority as Task["priority"],
      });
    } catch (error) {
      console.error("Error updating priority:", error);
      toast.error("Failed to update priority");
    }
  };

  // Handle tech icon add
  const handleTechIconAdd = async (iconSlug: string) => {
    // Don't add if already exists
    if (techIcons.includes(iconSlug)) {
      setShowIconPicker(false);
      return;
    }

    const updatedIcons = [...techIcons, iconSlug];

    try {
      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          tech_icons: updatedIcons, // Send as array, API will stringify it
          tech_icon: iconSlug, // For backward compatibility
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add tech icon");
      }

      // Update the local state
      onTaskUpdate({
        ...task,
        tech_icons: JSON.stringify(updatedIcons),
        tech_icon: iconSlug || null, // For backward compatibility
      });

      setTechIcons(updatedIcons);
      setShowIconPicker(false);
    } catch (error) {
      console.error("Error adding tech icon:", error);
      toast.error("Failed to add tech icon");
    }
  };

  // Handle tech icon removal
  const handleRemoveTechIcon = async (iconSlug: string) => {
    const updatedIcons = techIcons.filter(slug => slug !== iconSlug);

    try {

      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          tech_icons: updatedIcons, // Send as array, API will stringify it
          tech_icon: updatedIcons.length > 0 ? updatedIcons[0] : null, // For backward compatibility
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove tech icon");
      }

      // Update the local state
      onTaskUpdate({
        ...task,
        tech_icons: JSON.stringify(updatedIcons),
        tech_icon: updatedIcons.length > 0 ? updatedIcons[0] : null, // For backward compatibility
      });

      setTechIcons(updatedIcons);
    } catch (error) {
      console.error("Error removing tech icon:", error);
      toast.error("Failed to remove tech icon");
    }
  };

  // Priority configuration
  const priorityConfig = {
    LOW: {
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
      icon: <ArrowDown className="h-4 w-4" />,
      label: "Low"
    },
    MEDIUM: {
      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      buttonColor: "bg-green-600 hover:bg-green-700",
      icon: <ArrowRight className="h-4 w-4" />,
      label: "Medium"
    },
    HIGH: {
      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      buttonColor: "bg-orange-600 hover:bg-orange-700",
      icon: <ArrowUp className="h-4 w-4" />,
      label: "High"
    },
    URGENT: {
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      buttonColor: "bg-red-600 hover:bg-red-700",
      icon: <AlertTriangle className="h-4 w-4" />,
      label: "Urgent"
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {isEditingTitle ? "Edit Task" : task.title}
            </DialogTitle>
            <DialogClose className="absolute right-4 top-4">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Title</h3>
                {!isEditingTitle && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingTitle(true)}
                    className="h-7 px-2"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingTitle ? (
                <div className="space-y-2">
                  <Textarea
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="resize-none w-full min-h-[60px]"
                    autoFocus
                    placeholder="Task title"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleTitleUpdate}>Save</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTitle(task.title);
                        setIsEditingTitle(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-base">{task.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Description</h3>
                {!isEditingDescription && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingDescription(true)}
                    className="h-7 px-2"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none w-full min-h-[120px] max-w-full"
                    autoFocus
                    placeholder="Add a description..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleDescriptionUpdate}>Save</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDescription(task.description || "");
                        setIsEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-muted/30 dark:bg-gray-800/50 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                  {task.description || "No description provided."}
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Priority</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedPriority === "LOW" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "justify-center",
                    selectedPriority === "LOW" && `${priorityConfig.LOW.buttonColor} text-white`
                  )}
                  onClick={() => handlePriorityUpdate("LOW")}
                >
                  {priorityConfig.LOW.icon}
                  <span className="ml-1">{priorityConfig.LOW.label}</span>
                </Button>
                <Button
                  variant={selectedPriority === "MEDIUM" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "justify-center",
                    selectedPriority === "MEDIUM" && `${priorityConfig.MEDIUM.buttonColor} text-white`
                  )}
                  onClick={() => handlePriorityUpdate("MEDIUM")}
                >
                  {priorityConfig.MEDIUM.icon}
                  <span className="ml-1">{priorityConfig.MEDIUM.label}</span>
                </Button>
                <Button
                  variant={selectedPriority === "HIGH" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "justify-center",
                    selectedPriority === "HIGH" && `${priorityConfig.HIGH.buttonColor} text-white`
                  )}
                  onClick={() => handlePriorityUpdate("HIGH")}
                >
                  {priorityConfig.HIGH.icon}
                  <span className="ml-1">{priorityConfig.HIGH.label}</span>
                </Button>
                <Button
                  variant={selectedPriority === "URGENT" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "justify-center",
                    selectedPriority === "URGENT" && `${priorityConfig.URGENT.buttonColor} text-white`
                  )}
                  onClick={() => handlePriorityUpdate("URGENT")}
                >
                  {priorityConfig.URGENT.icon}
                  <span className="ml-1">{priorityConfig.URGENT.label}</span>
                </Button>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Due Date</h3>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleDueDateUpdate}
                  className="whitespace-nowrap"
                >
                  Set Date
                </Button>
              </div>
            </div>

            {/* Tech Icons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Tech Icons</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowIconPicker(true)}
                  className="h-7 px-2"
                >
                  <Code className="h-3.5 w-3.5 mr-1" />
                  Add Icon
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentTechIcons.length > 0 ? (
                  currentTechIcons.map((icon, index) => (
                    <div
                      key={`${icon.slug}-${index}`}
                      className="flex items-center gap-2 p-2 border rounded-md"
                    >
                      <div
                        className="h-6 w-6"
                        dangerouslySetInnerHTML={{ __html: icon.svg }}
                      />
                      <span className="text-sm">{icon.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 w-7 p-0 text-destructive"
                        onClick={() => handleRemoveTechIcon(icon.slug)}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground p-2">
                    No tech icons added. Click &quot;Add Icon&quot; to select technologies.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Task
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tech Icon Picker Dialog */}
      {showIconPicker && (
        <Dialog open={showIconPicker} onOpenChange={setShowIconPicker}>
          <DialogContent className="max-w-[90vw] sm:max-w-[700px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Select Tech Icon</DialogTitle>
            </DialogHeader>
            <TechIconPicker
              selectedIcons={techIcons}
              onSelectIcon={handleTechIconAdd}
              onClose={() => setShowIconPicker(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteTaskDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        task={task}
        onTaskDelete={(taskId) => {
          onTaskDelete(taskId);
          onOpenChange(false);
        }}
      />
    </>
  );
}
