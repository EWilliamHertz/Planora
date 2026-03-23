import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Users, Calendar, CheckSquare, TrendingUp, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PIE_COLORS = {
  accepted: "#22c55e",
  pending: "#f59e0b",
  declined: "#ef4444",
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/analytics`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Failed to load analytics</p>
      </div>
    );
  }

  const pieData = Object.entries(data.attendee_responses || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }));

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 animate-fadeIn" data-testid="analytics-page">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Meeting Analytics</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Track your booking trends, busiest time slots, and attendee engagement.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Events", value: data.total_events, icon: Calendar, color: "text-indigo-500" },
          { label: "Bookings", value: data.total_bookings, icon: TrendingUp, color: "text-emerald-500" },
          { label: "Upcoming", value: data.upcoming_events, icon: Clock, color: "text-amber-500" },
          { label: "Task Completion", value: `${data.task_completion_rate}%`, icon: CheckSquare, color: "text-sky-500" },
        ].map((stat) => (
          <div
            key={stat.label}
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Booking Trends */}
        <div className="bg-card border border-border rounded-xl p-5" data-testid="booking-trends-chart">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Booking Trends
          </h3>
          {data.booking_trends.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.booking_trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => {
                      const [y, m] = v.split("-");
                      return new Date(y, m - 1).toLocaleDateString("en", { month: "short" });
                    }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              No booking data yet. Share your booking link to get started.
            </div>
          )}
        </div>

        {/* Attendee Response Rates */}
        <div className="bg-card border border-border rounded-xl p-5" data-testid="attendee-chart">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Attendee Responses
          </h3>
          {data.total_attendees > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-[200px] w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={PIE_COLORS[entry.name] || "#6366f1"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: 13,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 flex-1">
                {Object.entries(data.attendee_responses).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[status] }} />
                      <span className="text-sm font-medium capitalize">{status}</span>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{count}</Badge>
                  </div>
                ))}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total Attendees</span>
                    <span className="text-sm font-bold">{data.total_attendees}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No attendee data yet. Invite people to your events.</p>
              </div>
            </div>
          )}
        </div>

        {/* Busiest Time Slots */}
        <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2" data-testid="busiest-slots-chart">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Busiest Time Slots
          </h3>
          {data.busiest_slots.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.busiest_slots} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis
                    dataKey="hour"
                    type="category"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    width={50}
                    tickFormatter={(v) => {
                      const h = parseInt(v);
                      return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Schedule more events to see your busiest times.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
