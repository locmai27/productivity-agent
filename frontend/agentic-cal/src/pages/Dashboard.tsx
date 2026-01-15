import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { addMonths, subMonths, startOfMonth, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarGrid } from "@/components/dashboard/CalendarGrid";
import TagManager from "@/components/dashboard/TagManager";
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

    // Color modal state
    const [colorModalTag, setColorModalTag] = useState<Tag | null>(null);
    const [colorDraft, setColorDraft] = useState<string>("");
    const [hexInput, setHexInput] = useState<string>("");
    const [hexError, setHexError] = useState<string | null>(null);

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
                                onOpenColorPicker={handleOpenColorPicker}
                            />
                        </div>
                    </motion.aside>
                </div>
            </div>

            <ChatbotModal />

            {/* Color Picker Modal */}
            {colorModalTag && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="absolute inset-0 bg-black/50" onClick={handleCloseColorModal} />
                    
                    <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border bg-background shadow-2xl my-8">
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
