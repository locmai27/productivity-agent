import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { format } from "date-fns";
import type { Task } from "@/types/task";

interface CalendarDayProps {
    date: Date;
    isToday: boolean;
    isCurrentMonth: boolean;
    tasks: Task[];
    onToggleComplete: (id: string) => void;

    // Drag portal hooks
    onDragPortalStart?: (task: Task, clientX: number, clientY: number, rect: DOMRect) => void;
    onDragPortalMove?: (clientX: number, clientY: number) => void;
    onDragPortalEnd?: (clientX: number, clientY: number) => void;

    // current dragging id so we can hide the original card while dragging
    draggingTaskId?: string | null;
    
    // Add task handler
    onAddTask?: (date: string) => void;
    onEditTask?: (task: Task) => void;
    onViewDay?: (date: string, tasks: Task[]) => void;
}

export function CalendarDay({
    date,
    isToday,
    isCurrentMonth,
    tasks,
    onToggleComplete,
    onDragPortalStart,
    onDragPortalMove,
    onDragPortalEnd,
    draggingTaskId,
    onAddTask,
    onEditTask,
    onViewDay,
}: CalendarDayProps) {
    const dayNumber = date.getDate();
    const [isHovered, setIsHovered] = useState(false);

    // Reset hover state when dragging starts
    useEffect(() => {
        if (draggingTaskId) {
            setIsHovered(false);
        }
    }, [draggingTaskId]);

    const handleDayClick = (e: React.MouseEvent) => {
        // Don't trigger if clicking on tasks or buttons
        const target = e.target as HTMLElement;
        if (target.closest('[data-task-card]') || target.closest('button')) {
            return;
        }
        onViewDay?.(format(date, "yyyy-MM-dd"), tasks);
    };

    return (
        <div
            data-date={format(date, "yyyy-MM-dd")}
            className={`min-h-[120px] border border-border/50 p-2 flex flex-col select-none relative group cursor-pointer ${
                isCurrentMonth ? "bg-card/30 hover:bg-card/50" : "bg-muted/20"
            } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleDayClick}
        >
            {/* Plus button */}
            {isHovered && onAddTask && !draggingTaskId && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddTask(format(date, "yyyy-MM-dd"));
                    }}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
                    aria-label="Add task"
                >
                    <Plus className="h-4 w-4" />
                </button>
            )}
            <div className="flex items-center justify-between mb-2">
                <span
                    className={`day-number text-sm font-medium w-7 h-7 rounded-full flex items-center justify-center ${
                        isToday
                            ? "bg-primary text-primary-foreground"
                            : isCurrentMonth
                            ? "bg-transparent text-foreground"
                            : "bg-transparent text-muted-foreground"
                    }`}
                >
                    {dayNumber}
                </span>
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto select-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {tasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onDragPortalStart={onDragPortalStart}
                        onDragPortalMove={onDragPortalMove}
                        onDragPortalEnd={onDragPortalEnd}
                        onEdit={onEditTask}
                        hideWhileDragging={draggingTaskId === task.id}
                    />
                ))}
            </div>
        </div>
    );
}
