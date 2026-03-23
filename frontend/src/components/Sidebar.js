import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  LayoutDashboard,
  Clock,
  Settings,
  LogOut,
  Share2,
  BarChart3,
  Users,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Clock, label: "Availability", path: "/availability" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Users, label: "Teams", path: "/teams" },
  { icon: Share2, label: "Share", path: "/share" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar({ onNavigate }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sharedCalendars, setSharedCalendars] = useState([]);

  useEffect(() => {
    const fetchShares = async () => {
      try {
        const res = await fetch(`${API_URL}/api/calendar/shares`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSharedCalendars(data.shared_with_me || []);
        }
      } catch (e) {
        // silently fail
      }
    };
    fetchShares();
  }, []);

  const handleLogout = async () => {
    await logout();
    if (onNavigate) onNavigate();
  };

  return (
    <div
      className="w-64 h-full flex flex-col bg-card border-r border-border"
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
            <CalendarDays className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Planora</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Menu
        </p>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            data-testid={`nav-${item.label.toLowerCase()}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname === item.path
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        ))}

        {/* Shared Calendars */}
        {sharedCalendars.length > 0 && (
          <>
            <p className="px-3 mt-6 mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Shared Calendars
            </p>
            {sharedCalendars.map((share) => (
              <Link
                key={share.share_id}
                to={`/shared/${share.owner_user_id}`}
                onClick={onNavigate}
                data-testid={`shared-calendar-${share.share_id}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === `/shared/${share.owner_user_id}`
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px]">{share.owner_name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate">{share.owner_name || share.owner_email}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 py-2 hidden lg:block">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-medium text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </div>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.picture} className="object-cover" />
            <AvatarFallback className="text-xs font-medium">
              {user?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            data-testid="logout-btn"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
