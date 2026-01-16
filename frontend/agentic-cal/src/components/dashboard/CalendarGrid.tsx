import { CalendarDay } from "./CalendarDay";
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Task } from "@/types/task";

interface CalendarGridProps {
    month: Date;
    tasks: Task[];
    onToggleComplete: (id: string) => void;
    isFirstMonth?: boolean;

    // Drag portal hooks
    onDragPortalStart?: (task: Task, clientX: number, clientY: number, rect: DOMRect) => void;
    onDragPortalMove?: (clientX: number, clientY: number) => void;
    onDragPortalEnd?: (clientX: number, clientY: number) => void;

    draggingTaskId?: string | null;
    onAddTask?: (date: string) => void;
    onEditTask?: (task: Task) => void;
    onViewDay?: (date: string, tasks: Task[]) => void;
    onPrevMonth?: () => void;
    onToday?: () => void;
    onNextMonth?: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
    month,
    tasks,
    onToggleComplete,
    onDragPortalStart,
    onDragPortalMove,
    onPrevMonth,
    onToday,
    onNextMonth,
    onDragPortalEnd,
    draggingTaskId,
    onAddTask,
    onEditTask,
    onViewDay,
    isFirstMonth = false,
}: CalendarGridProps) {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const today = new Date();

    // Build slots so the grid shows only days for the month,
    // with empty slots before the 1st and after the last day.
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const leading = monthStart.getDay(); // 0 (Sun) - 6 (Sat)
    const totalSlots = leading + monthDays.length;
    const trailing = (7 - (totalSlots % 7)) % 7;
    const days: Array<Date | null> = [
        ...Array(leading).fill(null),
        ...monthDays,
        ...Array(trailing).fill(null),
    ];

    const getTasksForDate = (date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return tasks.filter((task) => task.date === dateStr);
    };

    return (
        <div className="mb-8 select-none">
            <div className="flex items-center justify-between mb-4 h-10">
                <h2 className="text-2xl font-bold text-foreground leading-none">
                    {format(month, "MMMM yyyy")}
                </h2>
                {isFirstMonth && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={onPrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={onToday}>
                            Today
                        </Button>
                        <Button variant="outline" size="sm" onClick={onNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-7 gap-0 mb-1">
                {WEEKDAYS.map((day) => (
                    <div
                        key={day}
                        className="text-center text-sm font-medium text-muted-foreground py-2 border-b border-border/50"
                    >
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-0">
                {days.map((day, idx) =>
                    day ? (
                        <CalendarDay
                            key={day.toISOString()}
                            date={day}
                            isToday={isSameDay(day, today)}
                            isCurrentMonth={isSameMonth(day, month)}
                            tasks={getTasksForDate(day)}
                            onToggleComplete={onToggleComplete}
                            onDragPortalStart={onDragPortalStart}
                            onDragPortalMove={onDragPortalMove}
                            onDragPortalEnd={onDragPortalEnd}
                            draggingTaskId={draggingTaskId}
                            onAddTask={onAddTask}
                            onEditTask={onEditTask}
                            onViewDay={onViewDay}
                        />
                    ) : (
                        <div
                            key={`empty-${idx}`}
                            className={`min-h-[120px] border border-border/50 p-2 flex flex-col bg-transparent`}
                        />
                    )
                )}
            </div>
        </div>
    );
}
