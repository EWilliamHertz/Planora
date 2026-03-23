import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "work", label: "Work", color: "bg-indigo-500" },
  { value: "personal", label: "Personal", color: "bg-emerald-500" },
  { value: "urgent", label: "Urgent", color: "bg-rose-500" },
  { value: "health", label: "Health", color: "bg-sky-500" },
  { value: "finance", label: "Finance", color: "bg-amber-500" },
];

export function TaskModal({ open, onClose, task, onCreate, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState(null);
  const [status, setStatus] = useState("todo");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
      setCategory(task.category || null);
      setStatus(task.status || (task.completed ? "done" : "todo"));
    } else {
      setTitle("");
      setDescription("");
      setCategory(null);
      setStatus("todo");
      const d = new Date();
      d.setHours(17, 0, 0, 0);
      d.setDate(d.getDate() + 1);
      setDueDate(format(d, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [task, open]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const data = {
      title: title.trim(),
      description,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      completed: status === "done",
      category,
      status,
    };
    if (task) {
      onUpdate(task.task_id, data);
    } else {
      onCreate(data);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="task-modal">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription>
            {task ? "Update task details" : "Add a new task to your list"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              data-testid="task-title-input"
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Input
              data-testid="task-desc-input"
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2" data-testid="task-category-selector">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  data-testid={`task-category-${cat.value}`}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    category === cat.value
                      ? "border-foreground/30 bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/20 hover:bg-accent/50"
                  )}
                  onClick={() => setCategory(category === cat.value ? null : cat.value)}
                >
                  <span className={cn("h-2 w-2 rounded-full", cat.color)} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2" data-testid="task-status-selector">
              {[
                { value: "todo", label: "To Do" },
                { value: "in_progress", label: "In Progress" },
                { value: "done", label: "Done" },
              ].map((s) => (
                <button
                  key={s.value}
                  data-testid={`task-status-${s.value}`}
                  type="button"
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border-2 text-xs font-medium transition-colors",
                    status === s.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                  onClick={() => setStatus(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due date</Label>
            <Input
              data-testid="task-due-date-input"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {task && (
            <Button
              data-testid="task-delete-btn"
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(task.task_id);
                onClose();
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button data-testid="task-cancel-btn" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button data-testid="task-save-btn" size="sm" onClick={handleSubmit} disabled={!title.trim()}>
              {task ? "Update" : "Create"} Task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
