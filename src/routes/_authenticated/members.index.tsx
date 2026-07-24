import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fmtCurrency, fmtDate, initials } from "@/lib/format";
import { Plus, Search, Users } from "lucide-react";
import { z } from "zod";
import { useDebouncedValue } from "@/hooks/use-debounced";

const searchSchema = z.object({
  status: z.enum(["all", "active", "expiring_soon", "expired", "frozen"]).optional().catch("all"),
});

export const Route = createFileRoute("/_authenticated/members/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Members — Fitness Dream" },
      { name: "description", content: "Search, filter, and manage every member of your gym." },
    ],
  }),
  component: MembersPage,
});

type StatusFilter = "all" | "active" | "expiring_soon" | "expired" | "frozen";
type SortKey = "name" | "join" | "expiry" | "balance";

const statusStyles: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  expiring_soon: "bg-warning/15 text-warning border-warning/30",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  frozen: "bg-muted text-muted-foreground border-border",
};

function MembersPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("expiry");
  const debouncedQ = useDebouncedValue(q, 300);

  const status = (search.status ?? "all") as StatusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["members-list", status, debouncedQ, sort],
    queryFn: async () => {
      let query = supabase.from("members_with_status").select("*");
      if (status !== "all") query = query.eq("status", status);
      if (debouncedQ.trim()) {
        const term = `%${debouncedQ.trim()}%`;
        query = query.or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
      }
      switch (sort) {
        case "name": query = query.order("full_name"); break;
        case "join": query = query.order("created_at", { ascending: false }); break;
        case "expiry": query = query.order("expiry_date"); break;
        case "balance": query = query.order("balance_due", { ascending: false }); break;
      }
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data ?? [];
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  return (
    <div>
      <PageHeader
        title="Members"
        description="Everyone training at Fitness Dream."
        actions={
          <Button asChild className="gradient-primary text-primary-foreground">
            <Link to="/members/new"><Plus className="h-4 w-4 mr-1" /> Add member</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => navigate({ search: { status: v as StatusFilter } })}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring_soon">Expiring soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="frozen">Frozen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="expiry">Sort: Expiry</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="join">Sort: Join date</SelectItem>
            <SelectItem value="balance">Sort: Balance due</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display font-semibold">No members yet</h3>
              <p className="text-sm text-muted-foreground">Add your first member or restore from a backup.</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button asChild className="gradient-primary text-primary-foreground"><Link to="/members/new">Add member</Link></Button>
              <Button asChild variant="outline"><Link to="/settings">Restore backup</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 animate-fade-in">
          {data!.map((m) => (
            <Link key={m.id} to="/members/$id" params={{ id: m.id! }} className="block">
              <Card className="card-hover">
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-11 w-11">
                    {m.photo_url ? <img src={m.photo_url} alt={m.full_name!} loading="lazy" decoding="async" /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {initials(m.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{m.full_name}</span>
                      <Badge variant="outline" className={`capitalize ${statusStyles[m.status!] ?? ""}`}>
                        {String(m.status).replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      <span>{m.phone}</span>
                      <span>Plan: {m.plan_type ?? "—"}</span>
                      <span>Expires {fmtDate(m.expiry_date)}</span>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium">{fmtCurrency(m.total_fee)}</div>
                    {Number(m.balance_due) > 0 ? (
                      <div className="text-xs text-destructive">Due {fmtCurrency(m.balance_due)}</div>
                    ) : (
                      <div className="text-xs text-success">Paid</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
