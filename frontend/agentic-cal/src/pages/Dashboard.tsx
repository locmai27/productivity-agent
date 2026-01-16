import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Bell, Plus, Trash2 } from "lucide-react";
import { addMonths, subMonths, startOfMonth, format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarGrid } from "@/components/dashboard/CalendarGrid";
import TagManager from "@/components/dashboard/TagManager";
import { ChatbotModal } from "@/components/dashboard/ChatbotModal";
import { TaskCard } from "@/components/dashboard/TaskCard";
import type { Task } from "@/types/task";
import type { Tag } from "@/types/tag";
import type { Reminder } from "@/types/reminder";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/firebase";
import * as api from "@/lib/api";
import { resetChatSession } from "@/lib/chat";

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
        reminders: [
            {
                id: "r-1-1",
                taskId: "1",
                description: "Prep notes 10 minutes before standup",
                reminderDate: `${format(new Date(), "yyyy-MM-dd")}T08:50`,
            },
            {
                id: "r-1-2",
                taskId: "1",
                description: "Join standup",
                reminderDate: `${format(new Date(), "yyyy-MM-dd")}T09:00`,
            },
        ],
    },
    {
        id: "2",
        title: "Review PRs",
        description: "Check pending pull requests on GitHub",
        completed: true,
        tags: [EXAMPLE_TAGS[0]],
        date: format(new Date(), "yyyy-MM-dd"),
        reminders: [
            {
                id: "r-2-1",
                taskId: "2",
                description: "Start PR review block",
                reminderDate: `${format(new Date(), "yyyy-MM-dd")}T11:30`,
            },
        ],
    },
    {
        id: "3",
        title: "Gym session",
        description: "Leg day workout",
        completed: false,
        tags: [EXAMPLE_TAGS[1]],
        date: format(addMonths(new Date(), 0), "yyyy-MM-") + "15",
        reminders: [],
    },
    {
        id: "4",
        title: "Doctor appointment",
        description: "Annual checkup at 2pm",
        completed: false,
        tags: [EXAMPLE_TAGS[1], EXAMPLE_TAGS[3]],
        date: format(addMonths(new Date(), 0), "yyyy-MM-") + "20",
        reminders: [
            {
                id: "r-4-1",
                taskId: "4",
                description: "Confirm appointment details",
                reminderDate: `${format(addMonths(new Date(), 0), "yyyy-MM-")}20T10:00`,
            },
            {
                id: "r-4-2",
                taskId: "4",
                description: "Leave home for clinic",
                reminderDate: `${format(addMonths(new Date(), 0), "yyyy-MM-")}20T13:30`,
            },
        ],
    },
    {
        id: "5",
        title: "Project deadline",
        description: "Submit final deliverables",
        completed: false,
        tags: [EXAMPLE_TAGS[0], EXAMPLE_TAGS[3]],
        date: format(addMonths(new Date(), 1), "yyyy-MM-") + "05",
        reminders: [
            {
                id: "r-5-1",
                taskId: "5",
                description: "Final review before submission",
                reminderDate: `${format(addMonths(new Date(), 1), "yyyy-MM-")}05T09:00`,
            },
        ],
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

    // Color modal state
    const [colorModalTag, setColorModalTag] = useState<Tag | null>(null);
    const [colorDraft, setColorDraft] = useState<string>("");
    const [hexInput, setHexInput] = useState<string>("");
    const [hexError, setHexError] = useState<string | null>(null);

    // New task modal state
    const [taskModalDate, setTaskModalDate] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState<string>("");
    const [newTaskDescription, setNewTaskDescription] = useState<string>("");
    const [newTaskTags, setNewTaskTags] = useState<Tag[]>([]);
    const [newTaskReminders, setNewTaskReminders] = useState<Reminder[]>([]);

    // Edit task modal state
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState<string>("");
    const [editTaskDescription, setEditTaskDescription] = useState<string>("");
    const [editTaskTags, setEditTaskTags] = useState<Tag[]>([]);
    const [editTaskReminders, setEditTaskReminders] = useState<Reminder[]>([]);

    // Day view modal state
    const [viewingDayDate, setViewingDayDate] = useState<string | null>(null);
    const [viewingDayTasks, setViewingDayTasks] = useState<Task[]>([]);

    // Color conversion helpers
    const hexToRgb = (hex: string) => {
        const h = hex.replace('#', '');
        const bigint = parseInt(h, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return { r, g, b };
    };

    const rgbToHex = (r: number, g: number, b: number) =>
        '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');

    const normalizeHex = (input: string) => {
        const clean = input.replace(/[^0-9A-Fa-f#]/g, '');
        if (clean.startsWith('#') && clean.length === 7) return clean.toLowerCase();
        if (!clean.startsWith('#') && clean.length === 6) return `#${clean.toLowerCase()}`;
        return null;
    };

    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const didResetChatRef = useRef(false);
    
    useEffect(() => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // logged in so dont really need to do anything
                console.log("logged in as user with UID", user.uid);
                // Load tasks and tags from API
                try {
                    setLoading(true);
                    setError(null);
                    // Reset chat session on page load/refresh
                    if (!didResetChatRef.current) {
                        didResetChatRef.current = true;
                        await resetChatSession();
                    }
                    const [loadedTasks, loadedTags] = await Promise.all([
                        api.fetchTasks(),
                        api.fetchTags()
                    ]);
                    setTasks(loadedTasks);
                    setTags(loadedTags);
                } catch (err) {
                    console.error("Failed to load data:", err);
                    setError(err instanceof Error ? err.message : "Failed to load data");
                    // Fall back to example data if API fails
                    setTasks(EXAMPLE_TASKS);
                    setTags(EXAMPLE_TAGS);
                } finally {
                    setLoading(false);
                }
            }
            else {
                navigate("/");
            }
        })
    }, []);

    useEffect(() => {
        const handler = async () => {
            try {
                const [loadedTasks, loadedTags] = await Promise.all([
                    api.fetchTasks(),
                    api.fetchTags()
                ]);
                setTasks(loadedTasks);
                setTags(loadedTags);
            } catch (err) {
                console.error("Failed to refresh calendar:", err);
            }
        };
        window.addEventListener("calendar-updated", handler);
        return () => window.removeEventListener("calendar-updated", handler);
    }, []);

    const handleLogout = () => {
        // Reset Backboard thread so a new session starts after logout/login
        resetChatSession()
            .catch(() => {})
            .finally(() => {
                signOut(auth).then(() => {
                    navigate("/");
                });
            });
    };

    const handleMemories = () => {
        navigate('/memories');
    };

    const isValidHexColor = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

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

    const handleToggleComplete = async (taskId: string) => {
        try {
            const updatedTask = await api.toggleTask(taskId);
            setTasks((prev) =>
                prev.map((task) =>
                    task.id === taskId ? updatedTask : task
                )
            );
            
            // Update day view tasks if the modal is open
            if (viewingDayDate) {
                setViewingDayTasks((prev) =>
                    prev.map((task) =>
                        task.id === taskId ? updatedTask : task
                    )
                );
            }
        } catch (err) {
            console.error("Failed to toggle task:", err);
            setError(err instanceof Error ? err.message : "Failed to toggle task");
        }
    };

    const handleMove = useCallback(async (taskId: string, newDate: string) => {
        try {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            const updatedTask = await api.updateTask(taskId, { ...task, date: newDate });
            setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
        } catch (err) {
            console.error("Failed to move task:", err);
            setError(err instanceof Error ? err.message : "Failed to move task");
        }
    }, [tasks]);

    const handleAddTag = async (name: string) => {
        try {
            const colors = ["#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#f59e0b", "#06b6d4"];
            const newTag = await api.createTag({
                name,
                color: colors[Math.floor(Math.random() * colors.length)],
            });
            setTags((prev) => [...prev, newTag]);
        } catch (err) {
            console.error("Failed to create tag:", err);
            setError(err instanceof Error ? err.message : "Failed to create tag");
        }
    };

    const handleEditTag = (id: string, name: string) => {
        setTags((prev) => prev.map((tag) => (tag.id === id ? { ...tag, name } : tag)));
    };

    const handleDeleteTag = async (id: string) => {
        try {
            await api.deleteTag(id);
            setTags((prev) => prev.filter((tag) => tag.id !== id));
        } catch (err) {
            console.error("Failed to delete tag:", err);
            setError(err instanceof Error ? err.message : "Failed to delete tag");
        }
    };

    const handleOpenColorPicker = (tag: Tag) => {
        setColorModalTag(tag);
        const normalized = normalizeHex(tag.color) ?? "#3b82f6";
        setColorDraft(normalized);
        setHexInput(normalized);
        setHexError(null);
    };

    const handleCloseColorModal = () => {
        setColorModalTag(null);
        setHexError(null);
    };

    const handleSaveColor = () => {
        if (!colorModalTag) return;
        if (!isValidHexColor(colorDraft)) {
            setHexError("Enter a valid hex like #3b82f6");
            return;
        }
        
        // Update the tag color in tags state
        setTags((prev) => prev.map((t) => (t.id === colorModalTag.id ? { ...t, color: colorDraft } : t)));
        
        // Update the tag color in all tasks that reference this tag
        setTasks((prev) => prev.map((task) => ({
            ...task,
            tags: task.tags.map((tag) => 
                tag.id === colorModalTag.id ? { ...tag, color: colorDraft } : tag
            )
        })));
        
        handleCloseColorModal();
    };

    const handleOpenTaskModal = (date: string) => {
        setTaskModalDate(date);
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskTags([]);
        setNewTaskReminders([]);
    };

    const handleCloseTaskModal = () => {
        setTaskModalDate(null);
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskTags([]);
        setNewTaskReminders([]);
    };

    const handleSaveNewTask = async () => {
        if (!newTaskTitle.trim()) {
            alert("Please enter a task title");
            return;
        }
        if (!taskModalDate) return;

        try {
            const newTask = await api.createTask({
                title: newTaskTitle,
                description: newTaskDescription,
                completed: false,
                tags: newTaskTags,
                date: taskModalDate,
                reminders: newTaskReminders,
            });

            setTasks((prev) => [...prev, newTask]);
            handleCloseTaskModal();
        } catch (err) {
            console.error("Failed to create task:", err);
            setError(err instanceof Error ? err.message : "Failed to create task");
        }
    };

    const handleToggleTaskTag = (tag: Tag) => {
        setNewTaskTags((prev) =>
            prev.some((t) => t.id === tag.id)
                ? prev.filter((t) => t.id !== tag.id)
                : [...prev, tag]
        );
    };

    const handleAddNewReminder = () => {
        const defaultDate = taskModalDate || format(new Date(), "yyyy-MM-dd");
        const defaultTime = "09:00"; // Default to 9:00 AM
        const newReminder: Reminder = {
            id: Date.now().toString(),
            taskId: "", // Will be set when task is created
            description: "",
            reminderDate: `${defaultDate}T${defaultTime}`,
        };
        setNewTaskReminders((prev) => [...prev, newReminder]);
    };

    const handleUpdateNewReminder = (id: string, field: 'description' | 'reminderDate', value: string) => {
        setNewTaskReminders((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const handleDeleteNewReminder = (id: string) => {
        setNewTaskReminders((prev) => prev.filter((r) => r.id !== id));
    };

    const handleAddEditReminder = () => {
        if (!editingTask) return;
        const defaultTime = "09:00"; // Default to 9:00 AM
        const newReminder: Reminder = {
            id: Date.now().toString(),
            taskId: editingTask.id,
            description: "",
            reminderDate: `${editingTask.date}T${defaultTime}`,
        };
        setEditTaskReminders((prev) => [...prev, newReminder]);
    };

    const handleUpdateEditReminder = (id: string, field: 'description' | 'reminderDate', value: string) => {
        setEditTaskReminders((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const handleDeleteEditReminder = (id: string) => {
        setEditTaskReminders((prev) => prev.filter((r) => r.id !== id));
    };

    const handleOpenEditModal = (task: Task) => {
        setEditingTask(task);
        setEditTaskTitle(task.title);
        setEditTaskDescription(task.description);
        setEditTaskTags(task.tags);
        setEditTaskReminders(task.reminders || []);
    };

    const handleCloseEditModal = () => {
        setEditingTask(null);
        setEditTaskTitle("");
        setEditTaskDescription("");
        setEditTaskTags([]);
        setEditTaskReminders([]);
    };

    const handleSaveEditTask = async () => {
        if (!editTaskTitle.trim()) {
            alert("Please enter a task title");
            return;
        }
        if (!editingTask) return;

        try {
            const updatedTask = await api.updateTask(editingTask.id, {
                title: editTaskTitle,
                description: editTaskDescription,
                tags: editTaskTags,
                reminders: editTaskReminders,
            });

            setTasks((prev) =>
                prev.map((task) =>
                    task.id === editingTask.id ? updatedTask : task
                )
            );

            // Update day view tasks if the modal is open
            if (viewingDayDate) {
                setViewingDayTasks((prev) =>
                    prev.map((task) =>
                        task.id === editingTask.id ? updatedTask : task
                    )
                );
            }

            handleCloseEditModal();
        } catch (err) {
            console.error("Failed to update task:", err);
            setError(err instanceof Error ? err.message : "Failed to update task");
        }
    };

    const handleDeleteTask = async () => {
        if (!editingTask) return;
        
        try {
            await api.deleteTask(editingTask.id);
            setTasks((prev) => prev.filter((task) => task.id !== editingTask.id));
            
            // Update day view tasks if the modal is open
            if (viewingDayDate) {
                setViewingDayTasks((prev) => prev.filter((task) => task.id !== editingTask.id));
            }
            
            handleCloseEditModal();
        } catch (err) {
            console.error("Failed to delete task:", err);
            setError(err instanceof Error ? err.message : "Failed to delete task");
        }
    };

    const handleToggleEditTaskTag = (tag: Tag) => {
        setEditTaskTags((prev) =>
            prev.some((t) => t.id === tag.id)
                ? prev.filter((t) => t.id !== tag.id)
                : [...prev, tag]
        );
    };

    const handleViewDay = (date: string, tasks: Task[]) => {
        setViewingDayDate(date);
        setViewingDayTasks(tasks);
    };

    const handleCloseDayView = () => {
        setViewingDayDate(null);
        setViewingDayTasks([]);
    };

    const handleHexChange = (value: string) => {
        setHexInput(value);
        const normalized = normalizeHex(value);
        if (!normalized) {
            setHexError("Enter a valid hex like #3b82f6");
            return;
        }
        setHexError(null);
        setColorDraft(normalized);
    };

    const handleRgbChange = (channel: "r" | "g" | "b", value: string) => {
        const n = Math.max(0, Math.min(255, Number(value) || 0));
        const currentRgb = hexToRgb(colorDraft);
        const { r, g, b } = currentRgb;

        let next = colorDraft;
        if (channel === "r") next = rgbToHex(n, g, b);
        if (channel === "g") next = rgbToHex(r, n, b);
        if (channel === "b") next = rgbToHex(r, g, n);

        setColorDraft(next);
        setHexInput(next);
        setHexError(null);
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
        <div className="min-h-screen bg-background select-none relative overflow-hidden">
            {/* Subtle gradient background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5"></div>
                <div className="absolute top-0 left-1/2 w-96 h-96 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
                {/* Faint dotted texture */}
                <div
                    className="absolute inset-0 opacity-15"
                    style={{
                        backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.12) 1px, transparent 1px)",
                        backgroundSize: "24px 24px",
                    }}
                ></div>
            </div>

            {/* Content wrapper */}
            <div className="relative z-10">
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
                        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <CalendarIcon className="h-6 w-6 text-primary" />
                            <h1 className="text-xl font-bold text-foreground">AgenticCal</h1>
                        </Link>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleMemories}>
                                Memories
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleLogout}>
                                Log Out
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
                        {visibleMonths.map((month, index) => (
                            <CalendarGrid
                                key={month.toISOString()}
                                month={month}
                                tasks={tasks}
                                onToggleComplete={handleToggleComplete}
                                onDragPortalStart={handleDragPortalStart}
                                onDragPortalMove={handleDragPortalMove}
                                onDragPortalEnd={handleDragPortalEnd}
                                draggingTaskId={draggingTaskId}
                                onAddTask={handleOpenTaskModal}
                                onEditTask={handleOpenEditModal}
                                onViewDay={handleViewDay}
                                onPrevMonth={handlePrevMonth}
                                onToday={handleToday}
                                onNextMonth={handleNextMonth}
                                isFirstMonth={index === 0}
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
                                onOpenColorPicker={handleOpenColorPicker}
                            />
                        </div>
                    </motion.aside>
                </div>
            </div>

            <ChatbotModal />

            {/* Color Picker Modal */}
            <AnimatePresence>
                {colorModalTag && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 bg-black/50"
                            onClick={handleCloseColorModal}
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border bg-background shadow-2xl my-8"
                        >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 p-6 border-b">
                            <div className="min-w-0">
                                <h3 className="text-xl font-semibold truncate">
                                    Pick color for "{colorModalTag.name}"
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Use the wheel, swatches, or enter Hex/RGB.
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleCloseColorModal}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left: Color wheel and swatches */}
                                <div className="flex flex-col items-center gap-6">
                                    <input
                                        type="color"
                                        value={colorDraft}
                                        onChange={(e) => {
                                            const v = normalizeHex(e.target.value) ?? colorDraft;
                                            setColorDraft(v);
                                            setHexInput(v);
                                            setHexError(null);
                                        }}
                                        className="w-64 h-64 bg-transparent border-0 p-0 cursor-pointer rounded-lg"
                                        aria-label="Color wheel"
                                    />
                                    
                                    {/* Swatches */}
                                    <div className="w-full max-w-sm">
                                        <p className="text-sm text-muted-foreground mb-3">Quick swatches</p>
                                        <div className="flex flex-wrap gap-3">
                                            {["#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#f59e0b", "#06b6d4", "#8b5cf6", "#f97316"].map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                                                        c === colorDraft ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-110"
                                                    }`}
                                                    style={{ backgroundColor: c }}
                                                    onClick={() => {
                                                        const v = normalizeHex(c) ?? colorDraft;
                                                        setColorDraft(v);
                                                        setHexInput(v);
                                                        setHexError(null);
                                                    }}
                                                    aria-label={`Select ${c}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Inputs and preview */}
                                <div className="flex flex-col gap-6">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-16 h-16 rounded-xl border shadow-inner"
                                            style={{ backgroundColor: colorDraft }}
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-lg font-medium">Preview</span>
                                            <span className="text-sm text-muted-foreground font-mono">{colorDraft}</span>
                                        </div>
                                    </div>

                                    {/* Hex Input */}
                                    <div className="flex flex-col gap-3">
                                        <label className="text-sm font-medium text-muted-foreground">Hex Color</label>
                                        <Input
                                            value={hexInput}
                                            onChange={(e) => handleHexChange(e.target.value)}
                                            placeholder="#3b82f6"
                                            className="w-full text-base font-mono"
                                        />
                                        {hexError && (
                                            <p className="text-sm text-destructive">{hexError}</p>
                                        )}
                                    </div>

                                    {/* RGB Inputs */}
                                    <div className="flex flex-col gap-3">
                                        <label className="text-sm font-medium text-muted-foreground">RGB Values</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {(() => {
                                                const rgb = hexToRgb(colorDraft);
                                                return (
                                                    <>
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-xs text-muted-foreground text-center">Red</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={255}
                                                                value={rgb.r}
                                                                onChange={(e) => handleRgbChange("r", e.target.value)}
                                                                className="text-center"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-xs text-muted-foreground text-center">Green</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={255}
                                                                value={rgb.g}
                                                                onChange={(e) => handleRgbChange("g", e.target.value)}
                                                                className="text-center"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-xs text-muted-foreground text-center">Blue</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={255}
                                                                value={rgb.b}
                                                                onChange={(e) => handleRgbChange("b", e.target.value)}
                                                                className="text-center"
                                                            />
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 border-t">
                            <div className="text-xs text-muted-foreground">
                                Tip: Click swatches for quick picks.
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={handleCloseColorModal}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveColor}>
                                    Save
                                </Button>
                            </div>
                        </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            </div>

            {/* Task Modal */}
            <AnimatePresence>
                {taskModalDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 bg-black/50"
                            onClick={handleCloseTaskModal}
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="relative z-10 w-full max-w-md rounded-xl border bg-background shadow-2xl p-6"
                        >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold">Add Task</h3>
                            <Button variant="ghost" size="icon" onClick={handleCloseTaskModal}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="flex flex-col gap-4">
                            {/* Title Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="Enter task title"
                                    onKeyPress={(e) => {
                                        if (e.key === "Enter") handleSaveNewTask();
                                    }}
                                />
                            </div>

                            {/* Description Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Description</label>
                                <textarea
                                    value={newTaskDescription}
                                    onChange={(e) => setNewTaskDescription(e.target.value)}
                                    placeholder="Enter task description (optional)"
                                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>

                            {/* Tag Selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Tags</label>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleToggleTaskTag(tag)}
                                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all border-2 ${
                                                newTaskTags.some((t) => t.id === tag.id)
                                                    ? "border-current text-foreground"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                            }`}
                                            style={{
                                                backgroundColor: newTaskTags.some((t) => t.id === tag.id)
                                                    ? tag.color
                                                    : `${tag.color}20`,
                                                color: newTaskTags.some((t) => t.id === tag.id)
                                                    ? "#fff"
                                                    : tag.color,
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reminders Section */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Bell className="h-4 w-4" />
                                        Reminders
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleAddNewReminder}
                                        className="h-8"
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Reminder
                                    </Button>
                                </div>
                                {newTaskReminders.length > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                        {newTaskReminders.map((reminder) => (
                                            <div key={reminder.id} className="flex gap-2 items-start p-2 border rounded-md">
                                                <div className="flex-1 space-y-2">
                                                    <Input
                                                        placeholder="Reminder description"
                                                        value={reminder.description}
                                                        onChange={(e) => handleUpdateNewReminder(reminder.id, 'description', e.target.value)}
                                                        className="text-sm"
                                                    />
                                                    <Input
                                                        type="datetime-local"
                                                        value={reminder.reminderDate}
                                                        onChange={(e) => handleUpdateNewReminder(reminder.id, 'reminderDate', e.target.value)}
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteNewReminder(reminder.id)}
                                                    className="h-8 w-8 text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                            <Button variant="ghost" onClick={handleCloseTaskModal}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveNewTask}>
                                Add Task
                            </Button>
                        </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Task Modal */}
            <AnimatePresence>
                {editingTask && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 bg-black/50"
                            onClick={handleCloseEditModal}
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="relative z-10 w-full max-w-md rounded-xl border bg-background shadow-2xl p-6"
                        >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold">Edit Task</h3>
                            <Button variant="ghost" size="icon" onClick={handleCloseEditModal}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="flex flex-col gap-4">
                            {/* Title Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input
                                    value={editTaskTitle}
                                    onChange={(e) => setEditTaskTitle(e.target.value)}
                                    placeholder="Enter task title"
                                    onKeyPress={(e) => {
                                        if (e.key === "Enter") handleSaveEditTask();
                                    }}
                                />
                            </div>

                            {/* Description Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Description</label>
                                <textarea
                                    value={editTaskDescription}
                                    onChange={(e) => setEditTaskDescription(e.target.value)}
                                    placeholder="Enter task description (optional)"
                                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>

                            {/* Tag Selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Tags</label>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleToggleEditTaskTag(tag)}
                                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all border-2 ${
                                                editTaskTags.some((t) => t.id === tag.id)
                                                    ? "border-current text-foreground"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                            }`}
                                            style={{
                                                backgroundColor: editTaskTags.some((t) => t.id === tag.id)
                                                    ? tag.color
                                                    : `${tag.color}20`,
                                                color: editTaskTags.some((t) => t.id === tag.id)
                                                    ? "#fff"
                                                    : tag.color,
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reminders Section */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Bell className="h-4 w-4" />
                                        Reminders
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleAddEditReminder}
                                        className="h-8"
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Reminder
                                    </Button>
                                </div>
                                {editTaskReminders.length > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                        {editTaskReminders.map((reminder) => (
                                            <div key={reminder.id} className="flex gap-2 items-start p-2 border rounded-md">
                                                <div className="flex-1 space-y-2">
                                                    <Input
                                                        placeholder="Reminder description"
                                                        value={reminder.description}
                                                        onChange={(e) => handleUpdateEditReminder(reminder.id, 'description', e.target.value)}
                                                        className="text-sm"
                                                    />
                                                    <Input
                                                        type="datetime-local"
                                                        value={reminder.reminderDate}
                                                        onChange={(e) => handleUpdateEditReminder(reminder.id, 'reminderDate', e.target.value)}
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteEditReminder(reminder.id)}
                                                    className="h-8 w-8 text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
                            <Button variant="destructive" onClick={handleDeleteTask}>
                                Delete Task
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={handleCloseEditModal}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveEditTask}>
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Day View Modal */}
            <AnimatePresence>
                {viewingDayDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 bg-black/50"
                            onClick={handleCloseDayView}
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="relative z-10 w-full max-w-2xl max-h-[80vh] rounded-xl border bg-background shadow-2xl flex flex-col"
                        >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b">
                            <div>
                                <h3 className="text-xl font-semibold">
                                    {format(new Date(viewingDayDate + "T00:00:00"), "MMMM d, yyyy")}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {viewingDayTasks.length} {viewingDayTasks.length === 1 ? "task" : "tasks"}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleCloseDayView}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                            {viewingDayTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <CalendarIcon className="h-12 w-12 mb-4 opacity-50" />
                                    <p>No tasks for this day</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {viewingDayTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className={`p-4 rounded-lg border transition-all ${
                                                task.completed
                                                    ? "bg-muted/30 border-border/50"
                                                    : "bg-card border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    checked={task.completed}
                                                    onCheckedChange={() => handleToggleComplete(task.id)}
                                                    className="mt-1"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4
                                                        className={`text-lg font-medium mb-2 ${
                                                            task.completed
                                                                ? "line-through text-muted-foreground"
                                                                : "text-foreground"
                                                        }`}
                                                    >
                                                        {task.title}
                                                    </h4>
                                                    {task.description && (
                                                        <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                    {task.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {task.tags.map((tag) => (
                                                                <span
                                                                    key={tag.id}
                                                                    className="px-3 py-1 rounded-full text-xs font-medium text-white"
                                                                    style={{ backgroundColor: tag.color }}
                                                                >
                                                                    {tag.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenEditModal(task)}
                                                    className="flex-shrink-0"
                                                >
                                                    Edit
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 p-6 border-t">
                            <Button onClick={handleCloseDayView}>
                                Close
                            </Button>
                        </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Dashboard;
