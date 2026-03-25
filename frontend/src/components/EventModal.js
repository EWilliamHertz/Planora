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
import { Trash2, X, Search, Users, Repeat, Bell, Mail, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = [
  { value: "indigo", label: "Indigo", className: "bg-indigo-500" },
  { value: "emerald", label: "Green", className: "bg-emerald-500" },
  { value: "amber", label: "Amber", className: "bg-amber-500" },
  { value: "sky", label: "Blue", className: "bg-sky-500" },
  { value: "rose", label: "Red", className: "bg-rose-500" },
  { value: "violet", label: "Violet", className: "bg-violet-500" },
];

const STATUS_STYLES = {
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  declined: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export function EventModal({ open, onClose, event, selectedDate, onCreate, onUpdate, onDelete }) {
  const { authFetch } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState("indigo");
  const [teamId, setTeamId] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [reminder, setReminder] = useState("none");
  const [availableUsers, setAvailableUsers] = useState([]);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Fetch available users and teams from backend
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      try {
        // Build URL with search param if searchQuery is present
        const url = searchQuery 
          ? `/api/users/available?search=${encodeURIComponent(searchQuery)}`
          : "/api/users/available";
        const response = await authFetch(url, {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          // Filter out @example.com emails
          const realUsers = data.filter(u => !u.email.includes("@example.com"));
          setAvailableUsers(realUsers);
        }
      } catch (error) {
        console.error("Failed to fetch available users:", error);
        // Fallback: return empty list instead of showing @example.com mocks
        setAvailableUsers([]);
      }
    };

    const fetchUserTeams = async () => {
      try {
        const response = await authFetch("/api/teams", {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          setUserTeams(data);
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error);
        setUserTeams([]);
      }
    };

    if (open) {
      fetchAvailableUsers();
      fetchUserTeams();
    }
  }, [open, authFetch, searchQuery]);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setStartTime(event.start_time ? event.start_time.slice(0, 16) : "");
      setEndTime(event.end_time ? event.end_time.slice(0, 16) : "");
      setColor(event.color || "indigo");
      setAttendees(event.attendees || []);
      setRecurrenceType(event.recurrence?.type || "none");
      setRecurrenceEnd(event.recurrence?.end_date ? event.recurrence.end_date.slice(0, 10) : "");
      setReminder(event.reminder ? String(event.reminder) : "none");
      setInviteSent(false);
      setInviteError(null);
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
      setTeamId(null);
      setAttendees([]);
      setRecurrenceType("none");
      setRecurrenceEnd("");
      setReminder("none");
      setInviteSent(false);
      setInviteError(null);
    }
    setSearchQuery("");
    setShowSearch(false);
  }, [event, selectedDate, open]);

  const handleSubmit = async () => {
    if (!title.trim() || !startTime || !endTime) return;

    setInviteLoading(true);
    setInviteError(null);
    setInviteSent(false);

    try {
      const recurrence = recurrenceType !== "none"
        ? { type: recurrenceType, end_date: recurrenceEnd ? new Date(recurrenceEnd).toISOString() : null }
        : null;
      
      const data = {
        title: title.trim(),
        description,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        color,
        attendees,
        recurrence,
        reminder: reminder !== "none" ? parseInt(reminder) : null,
        team_id: teamId,
      };

      const targetId = event?.original_event_id || event?.event_id;
      
      if (event) {
        onUpdate(targetId, data);
      } else {
        const result = onCreate(data);
        
        // After event is created, send invites to all attendees
        if (attendees.length > 0 && result) {
          const eventId = result.event_id || targetId;
          
          for (const attendee of attendees) {
            try {
              const inviteResponse = await authFetch(`/api/events/${eventId}/invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  guest_email: attendee.email,
                  guest_name: attendee.name,
                }),
              });

              if (!inviteResponse.ok) {
                console.error(`Failed to send invite to ${attendee.email}`);
                setInviteError(`Failed to send email to ${attendee.email}`);
              }
            } catch (err) {
              console.error(`Error sending invite to ${attendee.email}:`, err);
              setInviteError(`Error sending email to ${attendee.email}`);
            }
          }

          if (!inviteError) {
            setInviteSent(true);
            setTimeout(() => {
              setInviteSent(false);
            }, 4000);
          }
        }
      }

      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      setInviteError("Failed to save event");
    } finally {
      setInviteLoading(false);
    }
  };

  const addAttendee = (user) => {
    if (!attendees.find(a => a.email === user.email)) {
      setAttendees((prev) => [
        ...prev,
        { name: user.name, email: user.email, avatar: user.avatar, status: "pending" },
      ]);
    }
    setSearchQuery("");
    setShowSearch(false);
  };

  const removeAttendee = (email) => {
    setAttendees((prev) => prev.filter((a) => a.email !== email));
  };

  const filteredUsers = availableUsers.filter(
    (u) =>
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !attendees.find((a) => a.email === u.email)
  );

  const isSharedEvent = attendees.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="event-modal">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{event ? "Edit Event" : "Create Event"}</DialogTitle>
            {teamId && (
            <Badge variant="outline" className="ml-auto">
              <Users className="h-3 w-3 mr-1" />
              Team Event
            </Badge>
          )}
          {isSharedEvent && !teamId && (
            <Badge variant="outline" className="ml-auto">
              <Users className="h-3 w-3 mr-1" />
              Shared Event
            </Badge>
          )}
          </div>
          <DialogDescription>
            {event ? "Update event details" : "Add a new event to your calendar"}
          </DialogDescription>
        </DialogHeader>

        {/* Invite Feedback Messages */}
        {inviteSent && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Mail className="h-4 w-4" />
            <span className="text-sm">
              ✓ Emails sent to {attendees.length} {attendees.length === 1 ? "person" : "people"}
            </span>
          </div>
        )}

        {inviteError && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3 flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{inviteError}</span>
          </div>
        )}

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

          {/* Team Selection */}
          {userTeams.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Team
              </Label>
              <Select value={teamId || "personal"} onValueChange={(value) => setTeamId(value === "personal" ? null : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team or personal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal (No Team)</SelectItem>
                  {userTeams.map((team) => (
                    <SelectItem key={team.team_id} value={team.team_id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recurrence */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" /> Repeat
            </Label>
            <Select value={recurrenceType} onValueChange={setRecurrenceType}>
              <SelectTrigger data-testid="event-recurrence-select">
                <SelectValue placeholder="Does not repeat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            {recurrenceType !== "none" && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ends on (optional)</Label>
                <Input
                  data-testid="event-recurrence-end-input"
                  type="date"
                  value={recurrenceEnd}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                />
              </div>
            )}
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
                        <AvatarFallback className="text-xs">{user.name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showSearch && searchQuery && filteredUsers.length === 0 && (
                <div className="absolute top-full left-0 right-0 bg-popover border border-border rounded-lg shadow-lg mt-1 z-20 p-3 text-center text-xs text-muted-foreground">
                  No users found. Email will still be sent to this address.
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

        {/* Reminder */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <Label>Reminder</Label>
          </div>
          <div className="flex gap-2 flex-wrap" data-testid="event-reminder-selector">
            {[
              { value: "none", label: "None" },
              { value: "5", label: "5 min" },
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "1 hour" },
            ].map((opt) => (
              <button
                key={opt.value}
                data-testid={`reminder-${opt.value}`}
                type="button"
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  reminder === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent/50"
                )}
                onClick={() => setReminder(opt.value)}
              >
                {opt.label}
              </button>
            ))}
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
            <Button
              data-testid="event-save-btn"
              size="sm"
              onClick={handleSubmit}
              disabled={!title.trim() || inviteLoading}
              className="relative"
            >
              {inviteLoading ? (
                <>
                  <span className="opacity-0">{event ? "Update" : "Create"} Event</span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="animate-spin">⏳</span>
                  </span>
                </>
              ) : (
                `${event ? "Update" : "Create"} Event`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
