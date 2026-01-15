import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { addMonths, subMonths, startOfMonth, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CalendarGrid } from "@/components/dashboard/CalendarGrid";
import { TagManager } from "@/components/dashboard/TagManager";
import { ChatbotModal } from "@/components/dashboard/ChatbotModal";
import { TaskCard } from "@/components/dashboard/TaskCard";
import type { Task } from "@/types/task";
import type { Tag } from "@/types/tag";

const EXAMPLE_TAGS: Tag[] = [
    { id: "1", name: "work", color: "#3b82f6" },
    { id: "2", name: "health", color: "#22c55e" },
    { id: "3", name: "meeting", color: "#a855f7" },
    { id: "4", name: "important", color: "#ef4444" },
];

const EXAMPLE_TASKS: Task[] = [
    {
        id: "1",
        title: "Team standup",
        description: "Daily sync with the development team",
        completed: false,
        tags: [EXAMPLE_TAGS[0], EXAMPLE_TAGS[2]],
        date: format(new Date(), "yyyy-MM-dd"),
    },
    {
        id: "2",
        title: "Review PRs",
        description: "Check pending pull requests on GitHub",
        completed: true,
        tags: [EXAMPLE_TAGS[0]],
        date: format(new Date(), "yyyy-MM-dd"),
    },
    {
        id: "3",
        title: "Gym session",
        description: "Leg day workout",
        completed: false,
        tags: [EXAMPLE_TAGS[1]],
        date: format(addMonths(new Date(), 0), "yyyy-MM-") + "15",
    },
    {
        id: "4",
        title: "Doctor appointment",
        description: "Annual checkup at 2pm",
        completed: false,
        tags: [EXAMPLE_TAGS[1], EXAMPLE_TAGS[3]],
        date: format(addMonths(new Date(), 0), "yyyy-MM-") + "20",
    },
    {
        id: "5",
        title: "Project deadline",
        description: "Submit final deliverables",
        completed: false,
        tags: [EXAMPLE_TAGS[0], EXAMPLE_TAGS[3]],
        date: format(addMonths(new Date(), 1), "yyyy-MM-") + "05",
    },
];

type DragPortalState = {
    task: Task;
    offsetX: number;
    offsetY: number;
    left: number;
    top: number;
    width: number;
} | null;

function Dashboard() {
    const [startMonth, setStartMonth] = useState(startOfMonth(new Date()));
    const [visibleMonths, setVisibleMonths] = useState<Date[]>([]);
    const [tasks, setTasks] = useState<Task[]>(EXAMPLE_TASKS);
    const [tags, setTags] = useState<Tag[]>(EXAMPLE_TAGS);

    const containerRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef<HTMLDivElement>(null);

    const [dragPortal, setDragPortal] = useState<DragPortalState>(null);
    const draggingTaskId = dragPortal?.task.id ?? null;

    const draggingTaskRef = useRef<Task | null>(null);

    useEffect(() => {
        const months: Date[] = [];
        for (let i = 0; i < 3; i++) {
            months.push(addMonths(startMonth, i));
        }
        setVisibleMonths(months);
    }, [startMonth]);

    const loadMoreMonths = useCallback(() => {
        setVisibleMonths((prev) => {
            const lastMonth = prev[prev.length - 1];
            return [...prev, addMonths(lastMonth, 1)];
        });
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreMonths();
                }
            },
            { threshold: 0.1 }
        );

        if (loadingRef.current) {
            observer.observe(loadingRef.current);
        }

        return () => observer.disconnect();
    }, [loadMoreMonths]);

    const handlePrevMonth = () => {
        setStartMonth((prev) => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setStartMonth((prev) => addMonths(prev, 1));
    };

    const handleToday = () => {
        setStartMonth(startOfMonth(new Date()));
        containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleToggleComplete = (taskId: string) => {
        setTasks((prev) =>
            prev.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
            )
        );
    };

    const handleMove = useCallback((taskId: string, newDate: string) => {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, date: newDate } : t)));
    }, []);

    const handleAddTag = (name: string) => {
        const colors = ["#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#f59e0b", "#06b6d4"];
        const newTag: Tag = {
            id: Date.now().toString(),
            name,
            color: colors[Math.floor(Math.random() * colors.length)],
        };
        setTags((prev) => [...prev, newTag]);
    };

    const handleEditTag = (id: string, name: string) => {
        setTags((prev) => prev.map((tag) => (tag.id === id ? { ...tag, name } : tag)));
    };

    const handleDeleteTag = (id: string) => {
        setTags((prev) => prev.filter((tag) => tag.id !== id));
    };

    const handleDragPortalStart = useCallback(
        (task: Task, clientX: number, clientY: number, rect: DOMRect) => {
            draggingTaskRef.current = task;

            const offsetX = clientX - rect.left;
            const offsetY = clientY - rect.top;

            setDragPortal({
                task,
                offsetX,
                offsetY,
                left: clientX - offsetX,
                top: clientY - offsetY,
                width: rect.width,
            });
        },
        []
    );

    const handleDragPortalMove = useCallback((clientX: number, clientY: number) => {
        setDragPortal((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                left: clientX - prev.offsetX,
                top: clientY - prev.offsetY,
            };
        });
    }, []);

    const handleDragPortalEnd = useCallback(
        (clientX: number, clientY: number) => {
            const active = draggingTaskRef.current;

            const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
            const dropTarget = el?.closest("[data-date]") as HTMLElement | null;
            const newDate = dropTarget?.getAttribute("data-date") || null;

            console.log("Drop pointer:", { x: clientX, y: clientY });
            console.log("Drop target date:", newDate);

            if (!active) {
                console.log("Drop: no active task");
            } else if (!newDate) {
                console.log("Drop: no [data-date] found under pointer");
            } else if (newDate === active.date) {
                console.log("Drop: same day, no move");
            } else {
                console.log(`Moving task "${active.title}" (${active.id}) from ${active.date} -> ${newDate}`);
                handleMove(active.id, newDate);
            }

            draggingTaskRef.current = null;
            setDragPortal(null);
        },
        [handleMove]
    );

    return (
        <div className="min-h-screen bg-background select-none">
            {/* Drag overlay layer */}
            {dragPortal && (
                <div className="fixed inset-0 z-[99999] pointer-events-none select-none">
                    <div
                        style={{
                            position: "absolute",
                            left: dragPortal.left,
                            top: dragPortal.top,
                            width: dragPortal.width,
                        }}
                    >
                        <TaskCard task={dragPortal.task} onToggleComplete={() => {}} isOverlay />
                    </div>
                </div>
            )}

            <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md select-none">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="h-6 w-6 text-primary" />
                            <h1 className="text-xl font-bold text-foreground">Calendar</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleToday}>
                                Today
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleNextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 select-none">
                <div className="flex gap-6">
                    <motion.div
                        ref={containerRef}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 overflow-auto select-none"
                    >
                        {visibleMonths.map((month) => (
                            <CalendarGrid
                                key={month.toISOString()}
                                month={month}
                                tasks={tasks}
                                onToggleComplete={handleToggleComplete}
                                onDragPortalStart={handleDragPortalStart}
                                onDragPortalMove={handleDragPortalMove}
                                onDragPortalEnd={handleDragPortalEnd}
                                draggingTaskId={draggingTaskId}
                            />
                        ))}

                        <div
                            ref={loadingRef}
                            className="h-20 flex items-center justify-center text-muted-foreground"
                        >
                            <span className="text-sm">Scroll for more months...</span>
                        </div>
                    </motion.div>

                    <motion.aside
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-64 flex-shrink-0 hidden lg:block select-none"
                    >
                        <div className="sticky top-24">
                            <TagManager
                                tags={tags}
                                onAddTag={handleAddTag}
                                onEditTag={handleEditTag}
                                onDeleteTag={handleDeleteTag}
                            />
                        </div>
                    </motion.aside>
                </div>
            </div>

            <ChatbotModal />
        </div>
    );
}

export default Dashboard;
