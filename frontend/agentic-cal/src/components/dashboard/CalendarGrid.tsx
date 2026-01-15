import { CalendarDay } from "./CalendarDay";
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    format,
} from "date-fns";

import type { Task } from "@/types/task";

interface CalendarGridProps {
    month: Date;
    tasks: Task[];
    onToggleComplete: (id: string) => void;

    // Drag portal hooks
    onDragPortalStart?: (task: Task, clientX: number, clientY: number, rect: DOMRect) => void;
    onDragPortalMove?: (clientX: number, clientY: number) => void;
    onDragPortalEnd?: (clientX: number, clientY: number) => void;

    draggingTaskId?: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
    month,
    tasks,
    onToggleComplete,
    onDragPortalStart,
    onDragPortalMove,
    onDragPortalEnd,
    draggingTaskId,
}: CalendarGridProps) {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const today = new Date();

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const getTasksForDate = (date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return tasks.filter((task) => task.date === dateStr);
    };

    return (
        <div className="mb-8 select-none">
            <h2 className="text-2xl font-bold mb-4 text-foreground">
                {format(month, "MMMM yyyy")}
            </h2>

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
                {days.map((day) => (
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
                    />
                ))}
            </div>
        </div>
    );
}
