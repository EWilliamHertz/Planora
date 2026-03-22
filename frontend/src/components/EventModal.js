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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, X, Search, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS = [
  { value: "indigo", label: "Indigo", className: "bg-indigo-500" },
  { value: "emerald", label: "Green", className: "bg-emerald-500" },
  { value: "amber", label: "Amber", className: "bg-amber-500" },
  { value: "sky", label: "Blue", className: "bg-sky-500" },
  { value: "rose", label: "Red", className: "bg-rose-500" },
  { value: "violet", label: "Violet", className: "bg-violet-500" },
];

const MOCK_USERS = [
  { name: "Sarah Chen", email: "sarah@example.com", avatar: "https://images.pexels.com/photos/30004324/pexels-photo-30004324.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { name: "Alex Kim", email: "alex@example.com", avatar: "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NDE4NTI4Mnww&ixlib=rb-4.1.0&q=85" },
  { name: "Jordan Lee", email: "jordan@acme.com", avatar: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NDE4NTI4Mnww&ixlib=rb-4.1.0&q=85" },
  { name: "Morgan Patel", email: "morgan@acme.com", avatar: null },
  { name: "Taylor Rivera", email: "taylor@example.com", avatar: null },
];

const STATUS_STYLES = {
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  declined: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export function EventModal({ open, onClose, event, selectedDate, onCreate, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState("indigo");
  const [attendees, setAttendees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setStartTime(event.start_time ? event.start_time.slice(0, 16) : "");
      setEndTime(event.end_time ? event.end_time.slice(0, 16) : "");
      setColor(event.color || "indigo");
      setAttendees(event.attendees || []);
    } else if (selectedDate) {
      setTitle("");
      setDescription("");
      const d = new Date(selectedDate);
      const hours = d.getHours();
      d.setHours(hours || 9, 0, 0, 0);
      setStartTime(format(d, "yyyy-MM-dd'T'HH:mm"));
      d.setHours((hours || 9) + 1);
      setEndTime(format(d, "yyyy-MM-dd'T'HH:mm"));
      setColor("indigo");
      setAttendees([]);
    }
    setSearchQuery("");
    setShowSearch(false);
  }, [event, selectedDate, open]);

  const handleSubmit = () => {
    if (!title.trim() || !startTime || !endTime) return;
    const data = {
      title: title.trim(),
      description,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      color,
      attendees,
    };
    if (event) {
      onUpdate(event.event_id, data);
    } else {
      onCreate(data);
    }
    onClose();
  };

  const addAttendee = (user) => {
    setAttendees((prev) => [
      ...prev,
      { name: user.name, email: user.email, avatar: user.avatar, status: "pending" },
    ]);
    setSearchQuery("");
    setShowSearch(false);
  };

  const removeAttendee = (email) => {
    setAttendees((prev) => prev.filter((a) => a.email !== email));
  };

  const filteredUsers = MOCK_USERS.filter(
    (u) =>
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !attendees.find((a) => a.email === u.email)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="event-modal">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            {event ? "Update event details" : "Add a new event to your calendar"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              data-testid="event-title-input"
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-desc">Description</Label>
            <Input
              data-testid="event-desc-input"
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                data-testid="event-start-input"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                data-testid="event-end-input"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  data-testid={`event-color-${c.value}`}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform",
                    c.className,
                    color === c.value ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"
                  )}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>

          {/* Invite People */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Invite People
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="event-invite-input"
                className="pl-9"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearch(true);
                }}
                onFocus={() => setShowSearch(true)}
              />
              {showSearch && searchQuery && filteredUsers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-popover border border-border rounded-lg shadow-lg mt-1 z-20 overflow-hidden">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.email}
                      data-testid={`invite-option-${user.email}`}
                      className="px-3 py-2.5 hover:bg-accent cursor-pointer flex items-center gap-2.5 transition-colors"
                      onClick={() => addAttendee(user)}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.avatar} className="object-cover" />
                        <AvatarFallback className="text-xs">{user.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {attendees.length > 0 && (
              <div className="space-y-2 mt-2">
                {attendees.map((att) => (
                  <div
                    key={att.email}
                    data-testid={`attendee-${att.email}`}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={att.avatar} className="object-cover" />
                      <AvatarFallback className="text-xs">{att.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{att.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{att.email}</div>
                    </div>
                    <Badge
                      className={cn("text-[10px] px-1.5 py-0 border-0", STATUS_STYLES[att.status] || STATUS_STYLES.pending)}
                    >
                      {att.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeAttendee(att.email)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {event && (
            <Button
              data-testid="event-delete-btn"
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(event.event_id);
                onClose();
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button data-testid="event-cancel-btn" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button data-testid="event-save-btn" size="sm" onClick={handleSubmit} disabled={!title.trim()}>
              {event ? "Update" : "Create"} Event
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
