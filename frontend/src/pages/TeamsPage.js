import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Users, Plus, Loader2, Trash2, Mail, Crown, UserPlus } from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);

  // Invite state
  const [inviteTeamId, setInviteTeamId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`${API_URL}/api/teams`, { credentials: "include" });
      if (res.ok) setTeams(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const createTeam = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: teamName.trim() }),
      });
      if (res.ok) {
        const team = await res.json();
        setTeams((prev) => [...prev, team]);
        setTeamName("");
        setShowCreate(false);
        toast.success("Team created!");
      }
    } catch (e) {
      toast.error("Failed to create team");
    }
    setCreating(false);
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !inviteTeamId) return;
    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/api/teams/${inviteTeamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setTeams((prev) =>
          prev.map((t) =>
            t.team_id === inviteTeamId
              ? { ...t, members: [...t.members, data.member] }
              : t
          )
        );
        setInviteEmail("");
        setInviteTeamId(null);
        toast.success("Member invited!");
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to invite");
      }
    } catch (e) {
      toast.error("Failed to invite");
    }
    setInviting(false);
  };

  const removeMember = async (teamId, email) => {
    try {
      const res = await fetch(`${API_URL}/api/teams/${teamId}/members/${encodeURIComponent(email)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setTeams((prev) =>
          prev.map((t) =>
            t.team_id === teamId
              ? { ...t, members: t.members.filter((m) => m.email !== email) }
              : t
          )
        );
        toast.success("Member removed");
      }
    } catch (e) {
      toast.error("Failed to remove");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-8 animate-fadeIn" data-testid="teams-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Team Workspaces</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create teams, invite members, and collaborate on schedules together.
          </p>
        </div>
        <Button data-testid="create-team-btn" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-bold mb-1">No teams yet</h2>
          <p className="text-sm text-muted-foreground mb-4">Create your first team to start collaborating</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Team
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const isAdmin = team.members.some(
              (m) => m.user_id === user?.user_id && m.role === "admin"
            );
            return (
              <div
                key={team.team_id}
                data-testid={`team-${team.team_id}`}
                className="bg-card border border-border rounded-xl p-5 animate-fadeIn"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">{team.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      data-testid={`invite-to-${team.team_id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => setInviteTeamId(team.team_id)}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {team.members.map((member) => (
                    <div
                      key={member.email}
                      data-testid={`member-${member.email}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs font-medium">
                          {member.name?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{member.name}</span>
                          {member.role === "admin" && (
                            <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                          )}
                          {member.user_id === user?.user_id && (
                            <Badge variant="outline" className="text-[9px] h-4">You</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      </div>
                      {isAdmin && member.user_id !== user?.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeMember(team.team_id, member.email)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md" data-testid="create-team-dialog">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Give your team a name to get started.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                data-testid="team-name-input"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Marketing, Engineering..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button data-testid="confirm-create-team" onClick={createTeam} disabled={creating || !teamName.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={!!inviteTeamId} onOpenChange={() => setInviteTeamId(null)}>
        <DialogContent className="sm:max-w-md" data-testid="invite-member-dialog">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>Invite someone to join your team by email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                data-testid="invite-email-input"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex gap-2">
                {["member", "admin"].map((r) => (
                  <button
                    key={r}
                    data-testid={`role-${r}`}
                    className={cn(
                      "flex-1 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-colors",
                      inviteRole === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                    onClick={() => setInviteRole(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteTeamId(null)}>Cancel</Button>
            <Button data-testid="confirm-invite" onClick={inviteMember} disabled={inviting || !inviteEmail.trim()}>
              {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
