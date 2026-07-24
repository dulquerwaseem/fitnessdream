import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { fmtCurrency, fmtDate } from "@/lib/format";
import {
  Users, AlertTriangle, TrendingUp, UserPlus, Calendar, Wallet,
  ArrowRight, Plus, Receipt, MessageCircle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Fitness Dream" },
      { name: "description", content: "Live gym metrics: active members, revenue, attendance, dues." },
    ],
  }),
  component: DashboardPage,
});

function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [members, expiring, revenue, joins, attendance, dues] = await Promise.all([
        // Active = not frozen AND expiry_date >= today (includes "expiring soon")
        supabase.from("members").select("id", { count: "exact", head: true }).is("frozen_at", null).gte("expiry_date", today),
        supabase.from("members_with_status").select("id, full_name, expiry_date, phone").eq("status", "expiring_soon").order("expiry_date"),
        supabase.from("payments").select("amount, paid_at").gte("paid_at", monthStart),
        // New joins MTD = start_date in current calendar month (not created_at, which reflects import time)
        supabase.from("members").select("id", { count: "exact", head: true }).gte("start_date", monthStartDate),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("subject_type", "member").gte("check_in", todayStart),
        supabase.from("members").select("balance_due"),
      ]);

      const revTotal = (revenue.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const outstanding = (dues.data ?? []).reduce((s, r) => s + Number(r.balance_due), 0);

      // Build last-30-days revenue series
      const days: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      (revenue.data ?? []).forEach((r) => {
        const k = String(r.paid_at).slice(0, 10);
        if (k in days) days[k] += Number(r.amount);
      });
      const revSeries = Object.entries(days).map(([date, value]) => ({ date: date.slice(5), value }));

      // Attendance last 14d
      const attStart = new Date(); attStart.setDate(attStart.getDate() - 13);
      const attRes = await supabase.from("attendance").select("check_in").eq("subject_type", "member").gte("check_in", attStart.toISOString());
      const attDays: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        attDays[d.toISOString().slice(0, 10)] = 0;
      }
      (attRes.data ?? []).forEach((a) => {
        const k = String(a.check_in).slice(0, 10);
        if (k in attDays) attDays[k] += 1;
      });
      const attSeries = Object.entries(attDays).map(([date, value]) => ({ date: date.slice(5), value }));

      return {
        activeCount: members.count ?? 0,
        expiringCount: (expiring.data ?? []).length,
        expiringList: (expiring.data ?? []).slice(0, 5),
        revTotal,
        newJoins: joins.count ?? 0,
        attendanceToday: attendance.count ?? 0,
        outstanding,
        revSeries,
        attSeries,
        in7,
      };
    },
  });
}

function StatCard({
  title, value, icon: Icon, tone,
}: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <Card className="card-hover animate-scale-in">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-display font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Live view of everything at your gym." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live view of everything at your gym."
        actions={
          <>
            <Button asChild size="sm" variant="outline"><Link to="/members/new"><Plus className="h-4 w-4 mr-1" /> Add member</Link></Button>
            <Button asChild size="sm" className="gradient-primary text-primary-foreground"><Link to="/billing/new"><Receipt className="h-4 w-4 mr-1" /> New invoice</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Active members" value={String(data.activeCount)} icon={Users} tone="bg-primary/10 text-primary" />
        <StatCard title="Expiring in 7d" value={String(data.expiringCount)} icon={AlertTriangle} tone="bg-warning/15 text-warning" />
        <StatCard title="Revenue (MTD)" value={fmtCurrency(data.revTotal)} icon={TrendingUp} tone="bg-success/15 text-success" />
        <StatCard title="New joins (MTD)" value={String(data.newJoins)} icon={UserPlus} tone="bg-chart-3/15 text-chart-3" />
        <StatCard title="Attendance today" value={String(data.attendanceToday)} icon={Calendar} tone="bg-chart-2/15 text-chart-2" />
        <StatCard title="Outstanding" value={fmtCurrency(data.outstanding)} icon={Wallet} tone="bg-destructive/10 text-destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-display">Revenue — last 30 days</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Daily collected payments</p>
            </div>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer>
              <LineChart data={data.revSeries}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Attendance (14d)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={data.attSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-display">Expiring this week</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Reach out and renew.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/members" search={{ status: "expiring_soon" }}>See all <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {data.expiringList.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nobody expiring in the next 7 days. Nice.</div>
          ) : (
            <div className="divide-y">
              {data.expiringList.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 gap-4">
                  <div className="min-w-0">
                    <Link to="/members/$id" params={{ id: m.id }} className="font-medium story-link">{m.full_name}</Link>
                    <div className="text-xs text-muted-foreground">Expires {fmtDate(m.expiry_date)}</div>
                  </div>
                  <Badge variant="outline" className="border-warning text-warning">
                    <MessageCircle className="h-3 w-3 mr-1" /> {m.phone}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LeadsWidget />
    </div>
  );
}

function LeadsWidget() {
  const { data } = useQuery({
    queryKey: ["leads-widget"],
    queryFn: async () => {
      const [stagesRes, leadsRes] = await Promise.all([
        supabase.from("lead_stages").select("*").order("order_index"),
        supabase.from("leads").select("id, stage_id, last_contacted_at, next_follow_up_at, created_at, converted_member_id, converted_at, full_name, phone"),
      ]);
      const stages = stagesRes.data ?? [];
      const leads = leadsRes.data ?? [];
      const now = Date.now();
      const dueToday = leads.filter(l => {
        if (l.converted_member_id) return false;
        if (l.next_follow_up_at) {
          const t = new Date(l.next_follow_up_at).getTime();
          if (t <= now) return true;
        }
        const stage = stages.find(s => s.id === l.stage_id);
        if (!stage?.follow_up_days) return false;
        const anchor = l.last_contacted_at ?? l.created_at;
        return now - new Date(anchor).getTime() > stage.follow_up_days * 86400000;
      });
      const byStage = stages.map(s => ({
        id: s.id,
        name: s.name,
        count: leads.filter(l => l.stage_id === s.id).length,
        isConverted: s.is_converted,
      }));
      const converted = leads.filter(l => l.converted_member_id).length;
      const total = leads.length;
      const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
      return { byStage, dueToday, conversionRate, total, converted };
    },
  });

  if (!data) return null;

  return (
    <div className="grid gap-6 md:grid-cols-3 mt-6">
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-display">Lead pipeline</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {data.total} total · {data.converted} converted · {data.conversionRate}% conversion rate
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/leads">Open pipeline <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
            {data.byStage.map(s => (
              <Link key={s.id} to="/leads" className="p-3 rounded-lg border card-hover">
                <div className="text-xs text-muted-foreground">{s.name}</div>
                <div className="text-2xl font-display font-bold">{s.count}</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-display">Follow-ups due</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Leads waiting on a reply.</p>
          </div>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">{data.dueToday.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {data.dueToday.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">All caught up.</div>
          ) : (
            <div className="divide-y">
              {data.dueToday.slice(0, 5).map(l => (
                <Link key={l.id} to="/leads/$id" params={{ id: l.id }} className="flex items-center justify-between p-3 gap-3 hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{l.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.phone}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
