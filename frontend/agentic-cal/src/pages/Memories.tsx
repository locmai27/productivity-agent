import { useState, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { ArrowLeft, Edit2, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Memory } from "@/types/memory";

const EXAMPLE_MEMORIES: Memory[] = [
    {
        id: "1",
        title: "User prefers morning tasks",
        content: "The user likes to schedule most of their tasks in the morning and tends to be more productive before noon.",
        priority: 10,
        createdAt: "2026-01-10T10:30:00Z",
        updatedAt: "2026-01-10T10:30:00Z",
    },
    {
        id: "2",
        title: "Important project deadline",
        content: "User has a major project due at the end of January. This is a critical deadline that requires focus.",
        priority: 9,
        createdAt: "2026-01-08T14:20:00Z",
        updatedAt: "2026-01-12T09:15:00Z",
    },
    {
        id: "3",
        title: "Health and fitness goals",
        content: "User is focused on gym sessions and health. They prefer working out in the evening, typically on leg day.",
        priority: 7,
        createdAt: "2026-01-05T16:45:00Z",
        updatedAt: "2026-01-10T11:00:00Z",
    },
    {
        id: "4",
        title: "Meeting preferences",
        content: "User prefers team meetings in the morning and sync-ups to be kept brief (max 30 minutes).",
        priority: 6,
        createdAt: "2026-01-03T12:10:00Z",
        updatedAt: "2026-01-03T12:10:00Z",
    },
    {
        id: "5",
        title: "Code review workflow",
        content: "User likes to review PRs after standup meetings and prefers meaningful feedback in reviews.",
        priority: 5,
        createdAt: "2025-12-28T09:50:00Z",
        updatedAt: "2025-12-28T09:50:00Z",
    },
];

function Memories() {
    const [memories, setMemories] = useState<Memory[]>(EXAMPLE_MEMORIES);
    const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
    const [editTitle, setEditTitle] = useState<string>("");
    const [editContent, setEditContent] = useState<string>("");

    const handleOpenEditModal = (memory: Memory) => {
        setEditingMemory(memory);
        setEditTitle(memory.title);
        setEditContent(memory.content);
    };

    const handleCloseEditModal = () => {
        setEditingMemory(null);
        setEditTitle("");
        setEditContent("");
    };

    const handleSaveEdit = () => {
        if (!editingMemory || !editTitle.trim()) {
            return;
        }

        setMemories((prev) =>
            prev.map((m) =>
                m.id === editingMemory.id
                    ? {
                        ...m,
                        title: editTitle,
                        content: editContent,
                        updatedAt: new Date().toISOString(),
                    }
                    : m
            )
        );

        handleCloseEditModal();
    };

    const handleDeleteMemory = (id: string) => {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        handleCloseEditModal();
    };

    const handleReorderMemories = (newOrder: Memory[]) => {
        // Update priorities based on new order
        const reorderedMemories = newOrder.map((memory, index) => ({
            ...memory,
            priority: newOrder.length - index, // Reverse so top = highest priority
        }));
        setMemories(reorderedMemories);
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Glassmorphism background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Gradient blobs */}
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
                {/* Faint dotted texture */}
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.15) 1px, transparent 1px)",
                        backgroundSize: "22px 22px",
                    }}
                ></div>
            </div>

            {/* Content wrapper with relative positioning */}
            <div className="relative z-10">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                            <h1 className="text-xl font-bold text-foreground">Back to Calendar</h1>
                        </Link>
                        <p className="text-sm text-muted-foreground">
                            {memories.length} {memories.length === 1 ? "memory" : "memories"}
                        </p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto">
                    {/* Info card */}
                    <div className="mb-8 p-4 rounded-lg border border-white/20 bg-white/10 backdrop-blur-md">
                        <p className="text-sm text-muted-foreground">
                            Drag memories to reorder them by priority. Memories at the top are prioritized higher by the chatbot.
                        </p>
                    </div>

                    {/* Memories list */}
                    {memories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <p className="text-lg font-medium mb-2">No memories yet</p>
                            <p className="text-sm">Memories will appear here when created</p>
                        </div>
                    ) : (
                        <Reorder.Group
                            axis="y"
                            values={memories}
                            onReorder={handleReorderMemories}
                            className="space-y-3"
                        >
                            {memories.map((memory, index) => (
                                <Reorder.Item
                                    key={memory.id}
                                    value={memory}
                                    className="cursor-grab active:cursor-grabbing"
                                >
                                    <motion.div
                                        layout
                                        className="group p-4 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Drag handle and priority indicator */}
                                            <div className="flex flex-col items-center gap-2 pt-1">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="text-muted-foreground">⋮⋮</div>
                                                </div>
                                                <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                                                    #{index + 1}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                                                    {memory.title}
                                                </h3>
                                                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                                                    {memory.content}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">
                                                        Updated {new Date(memory.updatedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenEditModal(memory)}
                                                    className="h-8 w-8"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteMemory(memory.id)}
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                    )}
                            </div>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingMemory && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                                <h3 className="text-xl font-semibold">Edit Memory</h3>
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
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        placeholder="Memory title"
                                        onKeyPress={(e) => {
                                            if (e.key === "Enter") handleSaveEdit();
                                        }}
                                    />
                                </div>

                                {/* Content Input */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium">Content</label>
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        placeholder="Memory details"
                                        className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
                                <Button
                                    variant="destructive"
                                    onClick={() => handleDeleteMemory(editingMemory.id)}
                                >
                                    Delete
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={handleCloseEditModal}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveEdit}>
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Memories;