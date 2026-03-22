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

export function TaskModal({ open, onClose, task, onCreate, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
    } else {
      setTitle("");
      setDescription("");
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
      completed: task?.completed || false,
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
