import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/types/task";

interface TaskCardProps {
    task: Task;
    onToggleComplete: (id: string) => void;

    // Portal drag hooks (driven by pointer events)
    onDragPortalStart?: (task: Task, clientX: number, clientY: number, rect: DOMRect) => void;
    onDragPortalMove?: (clientX: number, clientY: number) => void;
    onDragPortalEnd?: (clientX: number, clientY: number) => void;

    onEdit?: (task: Task) => void;
    isOverlay?: boolean;
    hideWhileDragging?: boolean;
}

export function TaskCard({
    task,
    onToggleComplete,
    onDragPortalStart,
    onDragPortalMove,
    onDragPortalEnd,
    onEdit,
    isOverlay = false,
    hideWhileDragging = false,
}: TaskCardProps) {
    const controls = useAnimation();
    const cardRef = useRef<HTMLDivElement | null>(null);

    const [isPointerDown, setIsPointerDown] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    const pointerIdRef = useRef<number | null>(null);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);

    // Store rect + whether we have actually started portal dragging
    const startRectRef = useRef<DOMRect | null>(null);
    const didStartPortalRef = useRef(false);

    useEffect(() => {
        controls.start({ opacity: 1, scale: 1 });
    }, [controls]);

    const containerClassName = useMemo(() => {
        return `p-2 rounded-md border transition-all cursor-pointer w-full h-20 relative ${
            isPointerDown ? "shadow-2xl" : ""
        } ${
            task.completed
                ? "bg-blue-500/5 border-border/50"
                : "bg-blue-500/20 border-border hover:border-primary/50"
        }`;
    }, [isPointerDown, task.completed]);

    useEffect(() => {
        if (!isPointerDown) {
            return;
        }

        const handlePointerMove = (e: PointerEvent) => {
            if (pointerIdRef.current === null || e.pointerId !== pointerIdRef.current) {
                return;
            }

            const start = startPointRef.current;
            if (!start) {
                return;
            }

            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Start portal only once the user has actually dragged
            if (!didStartPortalRef.current && dist > 6) {
                const rect = startRectRef.current;
                if (rect) {
                    didStartPortalRef.current = true;

                    // once we start dragging, stop showing "pressed" shrink
                    setIsPressed(false);

                    onDragPortalStart?.(task, start.x, start.y, rect);

                    // Immediately move it to current pointer position
                    onDragPortalMove?.(e.clientX, e.clientY);
                }
            } else if (didStartPortalRef.current) {
                onDragPortalMove?.(e.clientX, e.clientY);
            }
        };

        const endGesture = (e: PointerEvent) => {
            if (pointerIdRef.current === null || e.pointerId !== pointerIdRef.current) {
                return;
            }

            if (didStartPortalRef.current) {
                onDragPortalEnd?.(e.clientX, e.clientY);
            } else {
                // If we didn't start a drag, treat it as a click
                const start = startPointRef.current;
                if (start) {
                    const dx = e.clientX - start.x;
                    const dy = e.clientY - start.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // If movement was minimal, treat it as a click
                    if (dist < 6 && onEdit) {
                        onEdit(task);
                    }
                }
            }

            setIsPointerDown(false);
            setIsPressed(false);

            pointerIdRef.current = null;
            startPointRef.current = null;
            startRectRef.current = null;
            didStartPortalRef.current = false;
        };

        const handlePointerUp = (e: PointerEvent) => {
            endGesture(e);
        };

        const handlePointerCancel = (e: PointerEvent) => {
            endGesture(e);
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("pointerup", handlePointerUp, { passive: true });
        window.addEventListener("pointercancel", handlePointerCancel, { passive: true });
        window.addEventListener("blur", () => {
            // extra safety: if the window loses focus mid-press, reset
            setIsPointerDown(false);
            setIsPressed(false);
            pointerIdRef.current = null;
            startPointRef.current = null;
            startRectRef.current = null;
            didStartPortalRef.current = false;
        });

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
        };
    }, [isPointerDown, onDragPortalStart, onDragPortalMove, onDragPortalEnd, onEdit, task]);

    return (
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={controls}
            // IMPORTANT: no whileTap (it can get stuck with pointer capture + custom drag)
            onPointerDown={(e) => {
                if (isOverlay) {
                    return;
                }

                const target = e.target as HTMLElement | null;
                if (target?.closest('[role="checkbox"]')) {
                    return;
                }

                const rect = cardRef.current?.getBoundingClientRect();
                if (!rect) {
                    return;
                }

                pointerIdRef.current = e.pointerId;
                startPointRef.current = { x: e.clientX, y: e.clientY };
                startRectRef.current = rect;
                didStartPortalRef.current = false;

                setIsPointerDown(true);
                setIsPressed(true);

                // Capture pointer so we keep receiving events even if leaving the element
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            style={{
                position: "relative",
                zIndex: isPointerDown ? 1000 : "auto",
                opacity: hideWhileDragging ? 0 : 1,
                pointerEvents: isOverlay ? "none" : "auto",
                touchAction: "none",
                userSelect: "none",
                transform: isPressed ? "scale(0.98)" : "scale(1)",
                transition: "transform 100ms ease-out",
            }}
            className={containerClassName}
            data-task-card
        >
            <div className="flex items-start gap-2">
                <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => onToggleComplete(task.id)}
                    className="mt-0.5"
                    disabled={isOverlay}
                />
                <div className="flex-1 min-w-0">
                    <p
                        className={`text-sm font-medium leading-tight ${
                            task.completed ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                    >
                        {task.title}
                    </p>
                    {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {task.description}
                        </p>
                    )}
                    {task.tags.length > 0 && (
                        <div className="absolute bottom-2">
                            <div className="flex flex-wrap gap-1">
                                {task.tags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
