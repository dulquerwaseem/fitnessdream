import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { fmtDate } from "@/lib/format";
import { openWhatsApp, renderTemplate } from "@/lib/phone";
import {
  Users, AlertTriangle, UserPlus, ArrowRight, Plus, Receipt, MessageCircle,
  Bell, Dumbbell, Snowflake,
} from "lucide-react";


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
    queryKey: ["dashboard-ops"],
    queryFn: async () => {
      const now = new Date();
      const monthStartDate = localISO(new Date(now.getFullYear(), now.getMonth(), 1));
      const today = localISO(now);
      const in7 = localISO(new Date(now.getTime() + 7 * 86400000));
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const [members, expiring, joins, frozen, ptToday, duePayments, stagesRes, leadsRes] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }).is("deleted_at", null).is("frozen_at", null).gte("expiry_date", today),
        supabase.from("members").select("id, full_name, expiry_date, phone, frozen_at").is("deleted_at", null).is("frozen_at", null).gte("expiry_date", today).lte("expiry_date", in7).order("expiry_date"),
        supabase.from("members").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("start_date", monthStartDate),
        supabase.from("members").select("id", { count: "exact", head: true }).is("deleted_at", null).not("frozen_at", "is", null),
        supabase.from("pt_sessions").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd),
        supabase.from("invoices").select("id", { count: "exact", head: true }).is("deleted_at", null).neq("status", "paid").lte("issued_at", todayEnd),
        supabase.from("lead_stages").select("id, follow_up_days"),
        supabase.from("leads").select("id, stage_id, last_contacted_at, next_follow_up_at, created_at, converted_member_id").is("deleted_at", null),
      ]);

      const stages = stagesRes.data ?? [];
      const leads = leadsRes.data ?? [];
      const nowMs = Date.now();
      const followUpsDue = leads.filter(l => {
        if (l.converted_member_id) return false;
        if (l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() <= nowMs) return true;
        const stage = stages.find(s => s.id === l.stage_id);
        if (!stage?.follow_up_days) return false;
        const anchor = l.last_contacted_at ?? l.created_at;
        return nowMs - new Date(anchor).getTime() > stage.follow_up_days * 86400000;
      }).length;

      return {
        activeCount: members.count ?? 0,
        expiringCount: (expiring.data ?? []).length,
        expiringList: (expiring.data ?? []).slice(0, 5),
        newJoins: joins.count ?? 0,
        frozenCount: frozen.count ?? 0,
        ptToday: ptToday.count ?? 0,
        duePayments: duePayments.count ?? 0,
        followUpsDue,
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Link to="/members" search={{ status: "active" }} className="block">
          <StatCard title="Active members" value={String(data.activeCount)} icon={Users} tone="bg-primary/10 text-primary" />
        </Link>
        <Link to="/members" search={{ status: "expiring_soon" }} className="block">
          <StatCard title="Expiring in 7d" value={String(data.expiringCount)} icon={AlertTriangle} tone="bg-warning/15 text-warning" />
        </Link>
        <Link to="/leads" search={{ due: true }} className="block">
          <StatCard title="Follow-ups due" value={String(data.followUpsDue)} icon={Bell} tone="bg-destructive/10 text-destructive" />
        </Link>
        <Link to="/pt" search={{ today: true }} className="block">
          <StatCard title="PT sessions today" value={String(data.ptToday)} icon={Dumbbell} tone="bg-chart-3/15 text-chart-3" />
        </Link>
        <Link to="/members" search={{ status: "frozen" }} className="block">
          <StatCard title="Frozen memberships" value={String(data.frozenCount)} icon={Snowflake} tone="bg-muted text-muted-foreground" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mt-4">
        <Link to="/members" search={{ status: "new_mtd" }} className="block">
          <StatCard title="New joins (MTD)" value={String(data.newJoins)} icon={UserPlus} tone="bg-success/15 text-success" />
        </Link>
        <Link to="/billing" search={{ pending: true }} className="block">
          <StatCard title="Invoices pending" value={String(data.duePayments)} icon={Receipt} tone="bg-warning/15 text-warning" />
        </Link>
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
              {data.expiringList.filter(m => m.id).map((m) => (
                <ExpiringRow key={m.id!} m={{ id: m.id!, full_name: m.full_name, expiry_date: m.expiry_date, phone: m.phone }} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LeadsWidget />
    </div>
  );
}

const sourceLabels: Record<string, string> = {
  walk_in: "Walk-in", phone_inquiry: "Phone Inquiry", referral: "Referral",
  instagram: "Instagram", google: "Google", whatsapp_inquiry: "WhatsApp", other: "Other",
};

function LeadsWidget() {
  const { data } = useQuery({
    queryKey: ["leads-widget"],
    queryFn: async () => {
      const [stagesRes, leadsRes] = await Promise.all([
        supabase.from("lead_stages").select("*").order("order_index"),
        supabase.from("leads").select("id, stage_id, source, last_contacted_at, next_follow_up_at, created_at, converted_member_id, converted_at, full_name, phone").is("deleted_at", null),
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

  const openWA = (e: React.MouseEvent, phone: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    const msg = `Hi ${name.split(" ")[0]}, this is Fitness Dream — just following up on your inquiry. Let us know how we can help!`;
    openWhatsApp(phone, msg);
  };

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
            <CardTitle className="text-base font-display">Follow-ups due today</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Leads waiting on a reply.</p>
          </div>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{data.dueToday.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {data.dueToday.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">All caught up.</div>
          ) : (
            <div className="divide-y">
              {data.dueToday.slice(0, 6).map(l => {
                const anchor = l.last_contacted_at ?? l.created_at;
                const days = Math.max(0, Math.floor((Date.now() - new Date(anchor).getTime()) / 86400000));
                return (
                  <div key={l.id} className="flex items-center justify-between p-3 gap-2 hover:bg-muted/40">
                    <Link to="/leads/$id" params={{ id: l.id }} className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{l.full_name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {sourceLabels[l.source] ?? l.source} · {days === 0 ? "no contact yet" : `${days}d since contact`}
                      </div>
                    </Link>
                    <Button size="icon" variant="ghost" onClick={(e) => openWA(e, l.phone, l.full_name)} title="Send WhatsApp">
                      <MessageCircle className="h-4 w-4 text-success" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExpiringRow({ m }: { m: { id: string; full_name: string | null; expiry_date: string | null; phone: string | null } }) {
  const { data: gym } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: async () => (await supabase.from("gym_settings").select("*").maybeSingle()).data,
  });
  // Dynamic days-left calculation, computed fresh every render.
  let daysLeft = 0;
  if (m.expiry_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const exp = new Date(m.expiry_date); exp.setHours(0, 0, 0, 0);
    daysLeft = Math.round((exp.getTime() - today.getTime()) / 86400000);
  }
  const daysLabel = daysLeft === 0 ? "today" : daysLeft === 1 ? "1 day" : daysLeft > 0 ? `${daysLeft} days` : `${Math.abs(daysLeft)} day(s) ago`;
  const send = async () => {
    if (!m.phone) return;
    const templates = ((gym?.templates as Record<string, string>) ?? {});
    const key = daysLeft < 0 && templates["renewal_expired"] ? "renewal_expired" : "renewal";
    const tpl = templates[key] ?? "Hi {{name}}, your {{gym}} membership expires in {{days_left}} ({{expiry_date}}). Renew today to avoid a break in access.";
    const body = renderTemplate(tpl, {
      name: m.full_name ?? "",
      gym: gym?.name ?? "Fitness Dream",
      expiry_date: m.expiry_date ? fmtDate(m.expiry_date) : "",
      days_left: daysLabel,
      days_overdue: daysLeft < 0 ? String(Math.abs(daysLeft)) : "0",
      plan_type: "",
    });
    openWhatsApp(m.phone, body, gym?.whatsapp_country_code ?? "91");
    await supabase.from("messages_log").insert({
      member_id: m.id, channel: "whatsapp", template_key: key, body,
    });
  };
  return (
    <div className="flex items-center justify-between p-4 gap-4">
      <div className="min-w-0">
        <Link to="/members/$id" params={{ id: m.id }} className="font-medium story-link">{m.full_name}</Link>
        <div className="text-xs text-muted-foreground">
          Expires {fmtDate(m.expiry_date)} · <span className={daysLeft < 0 ? "text-destructive" : "text-warning"}>{daysLeft < 0 ? `Overdue ${daysLabel}` : `in ${daysLabel}`}</span>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={send} className="gap-1" title="Send renewal reminder">
        <MessageCircle className="h-3.5 w-3.5" /> Remind
      </Button>
    </div>
  );
}


