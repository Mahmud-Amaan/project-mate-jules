"use client";

import { useState, useEffect } from "react";
import { DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Task } from "./types";
import { useBoardData } from "./hooks/useBoardData";
import TrelloBoardContent from "./components/TrelloBoardContent";
import TaskDialog from "./dialogs/TaskDialog";
import BackgroundDialog from "./dialogs/BackgroundDialog";
import SortMenu from "./components/SortMenu";
import { Button } from "@/components/ui/button";
import { Search, Settings, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import "./styles/dragStyles.css";

interface TrelloBoardProps {
  projectId: string;
  initialTasks: Task[];
  isOwner: boolean;
  projectName?: string;
}

export default function TrelloBoard({
  projectId,
  initialTasks,
  isOwner,
  projectName = "Project Board",
}: TrelloBoardProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBackgroundDialogOpen, setIsBackgroundDialogOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [background, setBackground] = useState<{ type: string; value: string }>({
    type: "color",
    value: "#0079bf"
  });

  // Load background from localStorage on component mount
  useEffect(() => {
    const savedBackground = localStorage.getItem(`board-background-${projectId}`);
    if (savedBackground) {
      try {
        const parsedBackground = JSON.parse(savedBackground);
        setBackground(parsedBackground);
      } catch (error) {
        console.error("Error parsing saved background:", error);
      }
    }
  }, [projectId]);

  // Use custom hook for board data
  const {
    projectTasks,
    setProjectTasks,
    taskStatuses,
    setTaskStatuses,
    handleTaskUpdate,
    handleTaskCreate,
    handleTaskDelete,
    sortBy,
    sortDirection,
    applySorting: hookApplySorting,
  } = useBoardData({ projectId, initialTasks });

  // Wrapper for sorting function to ensure it updates filtered tasks too
  const applySorting = (field: string, direction: "asc" | "desc") => {
    console.log("TrelloBoard: applySorting called with", field, direction);

    try {
      // Apply sorting to all tasks
      hookApplySorting(field, direction);

      // After sorting is applied, projectTasks will be updated
      // Now we need to update filtered tasks based on the current projectTasks
      if (searchQuery) {
        // If we have a search filter, apply it to the project tasks
        const filtered = projectTasks.filter(
          (task) =>
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (task.description &&
              task.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        setFilteredTasks(filtered);
      } else {
        // Otherwise, use all project tasks
        setFilteredTasks([...projectTasks]);
      }

      // Success message is already shown in the hookApplySorting function
    } catch (error) {
      console.error("Error applying sorting:", error);
      toast.error("Failed to sort tasks");
    }
  };

  // State for filtered tasks
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(projectTasks);

  // Apply filter function (called when Enter is pressed)
  const applyFilter = () => {
    if (searchQuery) {
      // Filter tasks without changing their order
      const filtered = [...projectTasks].filter(
        (task) =>
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.description &&
            task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredTasks(filtered);
      toast.success(`Filtered to ${filtered.length} tasks`);
    } else {
      // If search query is empty, show all tasks without changing order
      setFilteredTasks([...projectTasks]);
    }
  };

  // Reset filters
  const resetFilters = () => {
    // Reset to current project tasks without changing order
    setFilteredTasks([...projectTasks]);
    setSearchQuery("");
    toast.success("Filters cleared");
  };

  // Initialize filtered tasks when component mounts
  useEffect(() => {
    // Initialize filtered tasks with project tasks
    setFilteredTasks(projectTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update filtered tasks when projectTasks or searchQuery changes
  useEffect(() => {
    console.log("projectTasks or searchQuery changed, updating filteredTasks");

    // If we have a search query, apply the filter
    if (searchQuery) {
      const filtered = projectTasks.filter(
        (task) =>
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.description &&
            task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredTasks(filtered);
    } else {
      // Otherwise, show all tasks
      setFilteredTasks(projectTasks);
    }
  }, [projectTasks, searchQuery]);

  // Helper function for column drag
  const _handleColumnDrag = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const columnId = draggableId.replace("column-", "");
    const columnToMove = taskStatuses.find((col) => col.id === columnId);

    if (!columnToMove) {
      toast.error("Column not found");
      return;
    }
    if (columnToMove.key === "BACKLOG" || columnToMove.is_default) {
      toast.error("Cannot move the Backlog column");
      return;
    }

    const originalColumns = [...taskStatuses];
    try {
      const sortedColumns = [...taskStatuses].sort((a, b) => a.order - b.order);
      const backlogColumn = sortedColumns.find(col => col.key === "BACKLOG" || col.is_default);
      const otherColumns = sortedColumns.filter(col =>
        col.id !== columnId && !(col.key === "BACKLOG" || col.is_default)
      );
      let reorderedColumns = backlogColumn ? [backlogColumn] : [];
      const adjustedIndex = Math.max(0, destination.index - (backlogColumn ? 1 : 0));
      otherColumns.splice(adjustedIndex, 0, columnToMove);
      reorderedColumns = [...reorderedColumns, ...otherColumns];
      const updatedColumns = reorderedColumns.map((col, index) => ({
        ...col,
        order: index
      }));
      setTaskStatuses(updatedColumns);
      await handleColumnReorder(columnId, adjustedIndex + (backlogColumn ? 1 : 0));
      toast.success(`Moved column "${columnToMove.name}"`);
    } catch (error) {
      console.error("Error reordering columns:", error);
      toast.error("Failed to reorder columns");
      setTaskStatuses(originalColumns);
    }
  };

  // Helper function for task reorder within the same column
  const _handleTaskReorderSameColumn = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const sourceStatus = source.droppableId;

    console.log("REORDERING TASK WITHIN SAME COLUMN", sourceStatus);
    console.log("From index", source.index, "to index", destination.index);

    const tasksInColumn: Task[] = [];
    const tasksInColumnIndices: number[] = [];
    projectTasks.forEach((task, index) => {
      if (task.status_key === sourceStatus || (task.status === sourceStatus && !task.status_key)) {
        tasksInColumn.push(task);
        tasksInColumnIndices.push(index);
      }
    });

    const taskToMove = tasksInColumn[source.index];
    if (!taskToMove) {
      console.error("Task not found for reordering");
      return;
    }

    const reorderedColumnTasks = [...tasksInColumn];
    reorderedColumnTasks.splice(source.index, 1);
    reorderedColumnTasks.splice(destination.index, 0, taskToMove);

    const allTasks: Task[] = [];
    projectTasks.forEach((task) => {
      if (task.status_key !== sourceStatus && !(task.status === sourceStatus && !task.status_key)) {
        allTasks.push(task);
      }
    });
    const insertPosition = tasksInColumnIndices.length > 0 ? Math.min(...tasksInColumnIndices) : allTasks.length;
    for (let i = 0; i < reorderedColumnTasks.length; i++) {
      allTasks.splice(insertPosition + i, 0, reorderedColumnTasks[i]);
    }
    setProjectTasks(allTasks);

    // Note: Filtered tasks update via useEffect watching projectTasks.
    // The original complex logic for manually updating filteredTasks here is removed for simplification,
    // relying on the existing useEffect to handle it.
    // If specific animations or immediate feedback on filtered list is needed, that part might need revisiting.
  };

  // Helper function for task movement between different columns
  const _handleTaskMoveDifferentColumn = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceStatus = source.droppableId;
    const destinationStatus = destination.droppableId;
    const taskId = draggableId;

    if (!destinationStatus) {
      toast.error("Invalid destination column");
      return;
    }

    const taskToMove = projectTasks.find((task) => task.id === taskId);
    if (!taskToMove) {
      toast.error("Task not found");
      return;
    }

    const originalTasks = [...projectTasks];
    const updatedTask = {
      ...taskToMove,
      status: destinationStatus as Task["status"], // Ensure Task["status"] is a union of string literals
      status_key: destinationStatus,
    };

    // Optimistic UI update
    const newProjectTasks = projectTasks.filter(task => task.id !== taskId);
    const destTasks = newProjectTasks.filter(task => task.status_key === destinationStatus || (task.status === destinationStatus && !task.status_key));
    destTasks.splice(destination.index, 0, updatedTask);

    // This is a simplified way to reconstruct the list.
    // For perfect order preservation of other items, a more complex merge is needed,
    // similar to the original logic. For now, this prioritizes getting the moved task in place.
    setProjectTasks([
        ...newProjectTasks.filter(task => task.status_key !== destinationStatus && !(task.status === destinationStatus && !task.status_key)),
        ...destTasks
    ]);


    try {
      console.log("MOVING TASK BETWEEN COLUMNS", sourceStatus, "->", destinationStatus);
      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: destinationStatus, status_key: destinationStatus }),
      });
      if (!response.ok) throw new Error("Failed to update task status");
      // If successful, projectTasks is already updated optimistically.
      // The useEffect for filteredTasks will handle updating that list.
    } catch (err) {
      console.error("Error updating task status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update task status");
      setProjectTasks(originalTasks); // Revert on error
    }
  };

  // Main drag and drop handler
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }
    if (!isOwner) {
      toast.error("You don't have permission to move items");
      return;
    }

    if (type === "COLUMN") {
      await _handleColumnDrag(result);
    } else { // Assuming type is TASK or not specified (defaults to task)
      if (source.droppableId === destination.droppableId) {
        _handleTaskReorderSameColumn(result); // This is currently not async
      } else {
        await _handleTaskMoveDifferentColumn(result);
      }
    }
  };

  // Handle column update
  const handleColumnUpdate = async (columnId: string, name: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/task-statuses/${columnId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update column");
      }

      // Update local state
      setTaskStatuses((prev) =>
        prev.map((status) =>
          status.id === columnId ? { ...status, name } : status
        )
      );
    } catch (error) {
      console.error("Error updating column:", error);
      throw error;
    }
  };

  // Handle column delete
  const handleColumnDelete = async (columnId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/task-statuses/${columnId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete column");
      }

      // Update local state
      setTaskStatuses((prev) => prev.filter((status) => status.id !== columnId));
    } catch (error) {
      console.error("Error deleting column:", error);
      toast.error("Failed to delete column");
    }
  };

  // Handle column add
  const handleColumnAdd = async (name: string) => {
    try {
      // Get all columns sorted by order
      const sortedColumns = [...taskStatuses].sort((a, b) => a.order - b.order);

      // Find the backlog column
      const backlogColumn = sortedColumns.find(col => col.key === "BACKLOG" || col.is_default);

      // Determine the new order value
      // If backlog exists, set order to be right after backlog
      // Otherwise, set order to be after the last column
      let newOrder;

      if (backlogColumn) {
        // Find the index of the backlog column
        const backlogIndex = sortedColumns.findIndex(col => col.id === backlogColumn.id);

        // If backlog is the last column, set order to backlog.order + 1
        // Otherwise, set order to be between backlog and the next column
        if (backlogIndex === sortedColumns.length - 1) {
          newOrder = backlogColumn.order + 1;
        } else {
          newOrder = backlogColumn.order + 1;

          // Update the order of all columns after backlog
          for (let i = backlogIndex + 1; i < sortedColumns.length; i++) {
            const col = sortedColumns[i];
            await handleColumnReorder(col.id, col.order + 1);
          }
        }
      } else {
        // No backlog column, set order to be after the last column
        const maxOrder = sortedColumns.reduce(
          (max, status) => (status.order > max ? status.order : max),
          -1
        );
        newOrder = maxOrder + 1;
      }

      // Generate a key from the name (uppercase, replace spaces with underscores)
      const key = name.toUpperCase().replace(/\s+/g, '_');

      const response = await fetch(`/api/projects/${projectId}/task-statuses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          key,
          color: "bg-gray-50 dark:bg-gray-900",
          order: newOrder,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create column");
      }

      const newStatus = await response.json();

      // Update the local state
      setTaskStatuses((prev) => {
        const updated = [...prev, newStatus];
        return updated.sort((a, b) => a.order - b.order);
      });
    } catch (error) {
      console.error("Error creating column:", error);
      toast.error("Failed to create column");
      throw error;
    }
  };

  // Handle column reorder
  const handleColumnReorder = async (columnId: string, newOrder: number) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/task-statuses/${columnId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order: newOrder }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to reorder column");
      }

      // The UI is already updated optimistically, so we don't need to update state here
    } catch (error) {
      console.error("Error reordering column:", error);
      throw error;
    }
  };

  // Handle add task with specific status
  const handleAddTaskWithStatus = (statusKey: string) => {
    setActiveStatus(statusKey);
    setIsCreateDialogOpen(true);
  };

  // Handle background change
  const handleBackgroundChange = (newBackground: { type: string; value: string }) => {
    setBackground(newBackground);
    // Save to localStorage
    localStorage.setItem(
      `board-background-${projectId}`,
      JSON.stringify(newBackground)
    );
  };

  // Get background style based on type and value
  const getBackgroundStyle = () => {
    if (background.type === "color") {
      return { backgroundColor: background.value };
    } else if (background.type === "image") {
      return {
        backgroundImage: `url(${background.value})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return {};
  };

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-gray-800 relative overflow-hidden"
      style={getBackgroundStyle()}
    >
      {/* Board Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3 border-b bg-white/90 dark:bg-gray-800/90 shadow-md backdrop-blur-sm">
        {/* Left section */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{projectName}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-3.5 w-3.5 text-muted-foreground ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={() => setIsBackgroundDialogOpen(true)}>
                <Palette className="h-4 w-4 mr-2" />
                Change Background
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center section - Search */}
        <div className="flex items-center gap-2 mx-auto">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search tasks... (press Enter)"
              className="pl-8 h-8 w-[200px] md:w-[300px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyFilter();
                }
              }}
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          <SortMenu
            onSort={applySorting}
            currentSortField={sortBy}
            currentSortDirection={sortDirection}
          />
          <ThemeToggle />
        </div>
      </div>

      {/* Board Content */}
      <TrelloBoardContent
        projectId={projectId}
        projectTasks={filteredTasks}
        taskStatuses={taskStatuses}
        canCreateTasks={true}
        canDragTasks={isOwner}
        canEditColumns={isOwner}
        canDragColumns={isOwner}
        onDragEnd={handleDragEnd}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
        onColumnUpdate={handleColumnUpdate}
        onColumnDelete={handleColumnDelete}
        onColumnAdd={handleColumnAdd}
        onColumnReorder={handleColumnReorder}
        onAddTask={handleAddTaskWithStatus}
      />

      {/* Filter Status Indicator */}
      {searchQuery && filteredTasks.length !== projectTasks.length && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 flex items-center gap-2 z-50">
          <div className="text-sm">
            Showing {filteredTasks.length} of {projectTasks.length} tasks
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-7 px-2"
          >
            Show All
          </Button>
        </div>
      )}

      {/* Create Task Dialog */}
      <TaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        projectId={projectId}
        taskStatuses={taskStatuses}
        onTaskCreate={handleTaskCreate}
        defaultStatus={activeStatus || undefined}
      />

      {/* Background Dialog */}
      <BackgroundDialog
        open={isBackgroundDialogOpen}
        onOpenChange={setIsBackgroundDialogOpen}
        currentBackground={background}
        onBackgroundChange={handleBackgroundChange}
      />
    </div>
  );
}
