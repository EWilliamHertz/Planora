import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { CalendarDayView } from "@/components/CalendarDayView";
import { DayView } from "@/components/DayView";
import { EventModal } from "@/components/EventModal";
import { TaskModal } from "@/components/TaskModal";
import { TaskSidebar } from "@/components/TaskSidebar";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { KanbanView } from "@/components/KanbanView";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useReminders } from "@/hooks/useReminders";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  Kanban,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { toast } from "sonner";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [calendarView, setCalendarView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayViewDate, setDayViewDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("planora_onboarded");
  });

  // Real-time task updates via WebSocket
  const handleWsMessage = useCallback((data) => {
    if (data.type === "task_update") {
      if (data.action === "created") {
        setTasks((prev) => {
          if (prev.find((t) => t.task_id === data.task.task_id)) return prev;
          return [...prev, data.task];
        });
      } else if (data.action === "updated") {
        setTasks((prev) => prev.map((t) => t.task_id === data.task.task_id ? data.task : t));
      } else if (data.action === "deleted") {
        setTasks((prev) => prev.filter((t) => t.task_id !== data.task.task_id));
      }
    }
  }, []);
  useWebSocket(handleWsMessage);

  // Event reminders
  useReminders();

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, tasksRes] = await Promise.all([
        authFetch(`${API_URL}/api/events`),
        authFetch(`${API_URL}/api/tasks`),
      ]);
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
    } catch (e) {
      console.error("Failed to fetch:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateEvent = async (data) => {
    try {
      const res = await authFetch(`${API_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const evt = await res.json();
        setEvents((prev) => [...prev, evt]);
        toast.success("Event created");
      }
    } catch (e) {
      toast.error("Failed to create event");
    }
  };

  const handleUpdateEvent = async (eventId, data) => {
    try {
      const res = await authFetch(`${API_URL}/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setEvents((prev) => prev.map((e) => (e.event_id === eventId ? updated : e)));
        toast.success("Event updated");
      }
    } catch (e) {
      toast.error("Failed to update event");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const res = await authFetch(`${API_URL}/api/events/${eventId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
        toast.success("Event deleted");
      }
    } catch (e) {
      toast.error("Failed to delete event");
    }
  };

  const handleCreateTask = async (data) => {
    try {
      const res = await authFetch(`${API_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [...prev, task]);
        toast.success("Task created");
      }
    } catch (e) {
      toast.error("Failed to create task");
    }
  };

  const handleUpdateTask = async (taskId, data) => {
    try {
      const res = await authFetch(`${API_URL}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.task_id === taskId ? updated : t)));
      }
    } catch (e) {
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const res = await authFetch(`${API_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
        toast.success("Task deleted");
      }
    } catch (e) {
      toast.error("Failed to delete task");
    }
  };

  const goToPrev = () => {
    if (calendarView === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (calendarView === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const goToNext = () => {
    if (calendarView === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (calendarView === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  // Expand recurring events for current view range
  const displayEvents = useMemo(() => {
    const viewStart = subMonths(startOfMonth(currentDate), 1);
    const viewEnd = addMonths(endOfMonth(currentDate), 1);
    const expanded = [];

    events.forEach((event) => {
      expanded.push(event);
      const rec = event.recurrence;
      if (!rec || !rec.type || rec.type === "none") return;

      const eventStart = parseISO(event.start_time);
      const eventEnd = parseISO(event.end_time);
      const duration = eventEnd.getTime() - eventStart.getTime();
      const recEnd = rec.end_date ? parseISO(rec.end_date) : addMonths(eventStart, 3);

      let current = new Date(eventStart);
      let safety = 0;
      while (safety < 400) {
        safety++;
        if (rec.type === "daily") current = addDays(current, 1);
        else if (rec.type === "weekly") current = addWeeks(current, 1);
        else if (rec.type === "monthly") current = addMonths(current, 1);
        else break;

        if (current > recEnd || current > viewEnd) break;
        if (current >= viewStart) {
          expanded.push({
            ...event,
            event_id: `${event.event_id}_${format(current, "yyyyMMddHHmm")}`,
            start_time: current.toISOString(),
            end_time: new Date(current.getTime() + duration).toISOString(),
            is_recurring_instance: true,
            original_event_id: event.event_id,
          });
        }
      }
    });
    return expanded;
  }, [events, currentDate]);

  // Drag-and-drop reschedule handler
  const handleEventDrop = async (eventId, newTimes) => {
    await handleUpdateEvent(eventId, newTimes);
  };

  const handleDayClick = (date) => {
    setDayViewDate(date);
  };

  const handleTimeSlotClick = (date, hour) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    setSelectedDate(d);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEventClick = (event) => {
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleDayViewEditEvent = (event) => {
    setDayViewDate(null);
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleDayViewDeleteEvent = async (eventId) => {
    await handleDeleteEvent(eventId);
  };

  const handleDayViewCreateEvent = () => {
    setDayViewDate(null);
    setEditingEvent(null);
    setSelectedDate(dayViewDate);
    setShowEventModal(true);
  };

  const handleTaskClick = (task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full" data-testid="dashboard-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setShowOnboarding(false);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="flex h-full" data-testid="dashboard-page">
      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-10 gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {calendarView === "day"
                ? format(currentDate, "EEEE, MMMM d, yyyy")
                : format(currentDate, "MMMM yyyy")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, MMMM d")} &middot; {events.length} events &middot; {tasks.filter(t => !t.completed).length} tasks pending
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center">
              <Button data-testid="calendar-prev-btn" variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button data-testid="calendar-today-btn" variant="outline" size="sm" className="h-8 px-3 text-xs font-medium" onClick={goToToday}>
                Today
              </Button>
              <Button data-testid="calendar-next-btn" variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Tabs value={calendarView} onValueChange={setCalendarView}>
              <TabsList className="h-8">
                <TabsTrigger data-testid="view-month-btn" value="month" className="text-xs px-3 h-6">Month</TabsTrigger>
                <TabsTrigger data-testid="view-week-btn" value="week" className="text-xs px-3 h-6">Week</TabsTrigger>
                <TabsTrigger data-testid="view-day-btn" value="day" className="text-xs px-3 h-6">Day</TabsTrigger>
                <TabsTrigger data-testid="view-kanban-btn" value="kanban" className="text-xs px-3 h-6">
                  <Kanban className="h-3 w-3 mr-1" />Board
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-1.5">
              <NotificationCenter />
              <Button data-testid="create-event-btn" size="sm" className="h-8 text-xs" onClick={() => { setEditingEvent(null); setSelectedDate(new Date()); setShowEventModal(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Event
              </Button>
              <Button data-testid="create-task-btn" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setEditingTask(null); setShowTaskModal(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Task
              </Button>
              <Button data-testid="toggle-sidebar-btn" variant="ghost" size="icon" className="h-8 w-8 hidden lg:flex" onClick={() => setShowRightSidebar(!showRightSidebar)}>
                {showRightSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar / Kanban */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {calendarView === "kanban" ? (
            <KanbanView
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onUpdateTask={handleUpdateTask}
              onCreateTask={() => { setEditingTask(null); setShowTaskModal(true); }}
            />
          ) : (
            <>
              {calendarView === "month" && (
                <CalendarMonthView
                  currentDate={currentDate}
                  events={displayEvents}
                  tasks={tasks}
                  onDayClick={handleDayClick}
                  onEventClick={handleEventClick}
                  onEventDrop={handleEventDrop}
                />
              )}
              {calendarView === "week" && (
                <CalendarWeekView
                  currentDate={currentDate}
                  events={displayEvents}
                  tasks={tasks}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                  onEventDrop={handleEventDrop}
                />
              )}
              {calendarView === "day" && (
                <CalendarDayView
                  currentDate={currentDate}
                  events={displayEvents}
                  tasks={tasks}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                  onEventDrop={handleEventDrop}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      {showRightSidebar && (
        <div className="hidden lg:block w-80 border-l border-border bg-card">
          <TaskSidebar
            tasks={tasks}
            events={events}
            onToggleTask={(taskId, completed) => handleUpdateTask(taskId, { completed })}
            onTaskClick={handleTaskClick}
            onDeleteTask={handleDeleteTask}
            onCreateTask={() => { setEditingTask(null); setShowTaskModal(true); }}
          />
        </div>
      )}

      {/* Modals */}
      <EventModal
        open={showEventModal}
        onClose={() => setShowEventModal(false)}
        event={editingEvent}
        selectedDate={selectedDate}
        onCreate={handleCreateEvent}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />
      <TaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        task={editingTask}
        onCreate={handleCreateTask}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
      />
      <DayView
        date={dayViewDate}
        events={events}
        onClose={() => setDayViewDate(null)}
        onEditEvent={handleDayViewEditEvent}
        onDeleteEvent={handleDayViewDeleteEvent}
        onCreateEvent={handleDayViewCreateEvent}
      />
    </div>
  );
}
