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
}: CalendarDayProps) {
    const dayNumber = date.getDate();

    return (
        <div
            data-date={format(date, "yyyy-MM-dd")}
            className={`min-h-[120px] border border-border/50 p-2 flex flex-col select-none ${
                isCurrentMonth ? "bg-card/30" : "bg-muted/20"
            } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
        >
            <div className="flex items-center justify-between mb-2">
                <span
                    className={`text-sm font-medium w-7 h-7 rounded-full flex items-center justify-center ${
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
                        hideWhileDragging={draggingTaskId === task.id}
                    />
                ))}
            </div>
        </div>
    );
}
