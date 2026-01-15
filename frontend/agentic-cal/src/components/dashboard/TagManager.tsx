import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagManagerProps {
  tags: Tag[];
  onAddTag: (name: string) => void;
  onEditTag: (id: string, name: string) => void;
  onDeleteTag: (id: string) => void;
}

export function TagManager({ tags, onAddTag, onEditTag, onDeleteTag }: TagManagerProps) {
  const [newTagName, setNewTagName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleAddTag = () => {
    if (newTagName.trim()) {
      onAddTag(newTagName.trim());
      setNewTagName("");
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditingName(tag.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onEditTag(editingId, editingName.trim());
      setEditingId(null);
      setEditingName("");
    }
  };

  return (
    <div className="glass-card p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Tags</h3>

      {/* Add new tag */}
      <div className="flex gap-2 mb-4">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="New tag name..."
          className="flex-1 bg-background/50"
          onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
        />
        <Button size="icon" onClick={handleAddTag} variant="outline">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Tag list */}
      <div className="space-y-2">
        {tags.map((tag) => (
          <motion.div
            key={tag.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 p-2 rounded-md bg-background/30 border border-border/50"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {editingId === tag.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 h-7 text-sm bg-background/50"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                  <Check className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-foreground">{tag.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleStartEdit(tag)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onDeleteTag(tag.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
