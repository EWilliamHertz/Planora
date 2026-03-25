import { useState, useEffect, useCallback } from "react";
import { Bell, Check, X, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { authFetch } from "@/contexts/AuthContext";
import { toast } from "sonner";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function NotificationCenter() {
  const [invites, setInvites] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

// Fetch pending invites
  const fetchInvites = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/invites/pending`);
      if (res.ok) {
        const data = await res.json();
        // Ensure data is strictly an Array before updating state
        setInvites(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch invites", error);
    }
  }, []);

  // Poll for new invites every 30 seconds
  useEffect(() => {
    fetchInvites();
    const interval = setInterval(fetchInvites, 30000);
    return () => clearInterval(interval);
  }, [fetchInvites]);

  const handleAction = async (inviteId, action) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/invites/${inviteId}/${action}`, {
        method: "POST",
      });
      
      if (res.ok) {
        toast.success(`Invite ${action}ed successfully`);
        // Remove the processed invite from the list
        setInvites((prev) => prev.filter((inv) => inv.invite_id !== inviteId));
        // If you accepted a team/event invite, you might want to reload the page or trigger a global refresh
        if (action === "accept") {
          window.location.reload(); 
        }
      } else {
        const err = await res.json();
        toast.error(err.detail || `Failed to ${action} invite`);
      }
    } catch (error) {
      toast.error(`An error occurred while trying to ${action} the invite.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative" data-testid="notification-bell">
          <Bell className="h-4 w-4" />
          {invites.length > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive border-2 border-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
            {invites.length} new
          </span>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">You have no pending invites.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {invites.map((invite) => (
                <div key={invite.invite_id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none mb-1">
                        {invite.type === 'team' ? 'Team Invitation' : 'Event Invitation'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium text-foreground">{invite.sender_name}</span> invited you to join 
                        <span className="font-medium text-foreground"> {invite.target_name}</span>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button 
                      size="sm" 
                      className="flex-1 h-7 text-xs" 
                      disabled={loading}
                      onClick={() => handleAction(invite.invite_id, 'accept')}
                    >
                      <Check className="h-3 w-3 mr-1" /> Accept
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-7 text-xs"
                      disabled={loading}
                      onClick={() => handleAction(invite.invite_id, 'decline')}
                    >
                      <X className="h-3 w-3 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}