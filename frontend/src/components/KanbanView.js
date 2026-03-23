import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Plus, GripVertical, Clock, Inbox, PlayCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO, isToday, isTomorrow, isBefore } from "date-fns";
import { EmptyState } from "@/components/EmptyState";

const CATEGORY_COLORS = {
  work: "bg-indigo-500",
  personal: "bg-emerald-500",
  urgent: "bg-rose-500",
  health: "bg-sky-500",
  finance: "bg-amber-500",
};

const COLUMNS = [
  { id: "todo", label: "To Do", color: "border-muted-foreground/20" },
  { id: "in_progress", label: "In Progress", color: "border-amber-500/30" },
  { id: "done", label: "Done", color: "border-emerald-500/30" },
];

const EMPTY_ICONS = { todo: Inbox, in_progress: PlayCircle, done: CheckCircle2 };
function formatDue(dateStr) {
const EMPTY_MESSAGES = {
  todo: { title: "Nothing to do", desc: "Add a task to get started" },
  in_progress: { title: "Nothing in progress", desc: "Drag tasks here when you start working" },
  done: { title: "No completed tasks", desc: "Finished tasks will appear here" },
};
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isBefore(d, new Date())) return "Overdue";
  return format(d, "MMM d");
}

export function KanbanView({ tasks, onTaskClick, onUpdateTask, onCreateTask }) {
  const [dragOverCol, setDragOverCol] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const getColumnTasks = (colId) => {
    return tasks.filter((t) => {
      const status = t.status || (t.completed ? "done" : "todo");
      return status === colId;
    });
  };

  const handleDragStart = (e, task) => {
    setDraggingId(task.task_id);
    e.dataTransfer.setData("text/plain", task.task_id);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.style.opacity = "0.4";
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const completed = colId === "done";
    onUpdateTask(taskId, { status: colId, completed });
  };

  return (
    <div className="flex gap-4 h-full p-4 overflow-x-auto" data-testid="kanban-view">
      {COLUMNS.map((col) => {
        const colTasks = getColumnTasks(col.id);
        return (
          <div
            key={col.id}
            data-testid={`kanban-col-${col.id}`}
            className={cn(
              "flex-1 min-w-[280px] max-w-[380px] flex flex-col rounded-xl border-2 bg-muted/20 transition-colors",
              col.color,
              dragOverCol === col.id && "bg-primary/5 border-primary/30"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverCol(col.id);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between p-3 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">{col.label}</h3>
                <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
                  {colTasks.length}
                </Badge>
              </div>
              {col.id === "todo" && (
                <Button
                  data-testid="kanban-add-task"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onCreateTask}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1 px-2 pb-2">
              <div className="space-y-2">
                {colTasks.map((task, i) => {
                  const dueLabel = formatDue(task.due_date);
                  const isOverdue = dueLabel === "Overdue";
                  const cat = task.category ? CATEGORY_COLORS[task.category] : null;
                  return (
                    <div
                      key={task.task_id}
                      data-testid={`kanban-card-${task.task_id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all animate-scaleIn",
                        draggingId === task.task_id && "opacity-40"
                      )}
                      style={{ animationDelay: `${i * 0.03}s` }}
                      onClick={() => onTaskClick(task)}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium leading-tight",
                            col.id === "done" && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {cat && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium capitalize text-muted-foreground">
                                <span className={cn("h-1.5 w-1.5 rounded-full", cat)} />
                                {task.category}
                              </span>
                            )}
                            {dueLabel && (
                              <span className={cn(
                                "inline-flex items-center gap-0.5 text-[10px]",
                                isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                              )}>
                                <Clock className="h-2.5 w-2.5" />
                                {dueLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <EmptyState
                    icon={EMPTY_ICONS[col.id]}
                    title={EMPTY_MESSAGES[col.id].title}
                    description={EMPTY_MESSAGES[col.id].desc}
                    action={col.id === "todo" && (
                      <Button size="sm" variant="outline" onClick={onCreateTask} data-testid="kanban-empty-add-task">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
                      </Button>
                    )}
                    className="py-6"
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
