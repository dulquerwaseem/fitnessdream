import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { downloadInvoicePdf, printInvoicePdf, shareInvoicePdfFile } from "@/lib/pdf";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { Plus, Printer, Receipt, Send, TrendingUp, Wallet } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";


export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Fitness Dream" },
      { name: "description", content: "Invoices, payments, and dues." },
    ],
  }),
  component: BillingPage,
});

const statusColor: Record<string, string> = {
  paid: "bg-success/15 text-success border-success/30",
  partial: "bg-warning/15 text-warning border-warning/30",
  unpaid: "bg-destructive/10 text-destructive border-destructive/30",
  refunded: "bg-muted text-muted-foreground",
};

function BillingPage() {
  const { isAdmin } = useSession();
  const [modeFilter, setModeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, number, total, amount_paid, status, issued_at, member:members!invoices_member_id_fkey(full_name, phone), payments(mode)")
        .order("issued_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (modeFilter === "all") return data ?? [];
    return (data ?? []).filter((inv: any) => (inv.payments ?? []).some((p: any) => p.mode === modeFilter));
  }, [data, modeFilter]);

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Invoices and payments."
        actions={
          <div className="flex items-center gap-2">
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Payment method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild className="gradient-primary text-primary-foreground">
              <Link to="/billing/new"><Plus className="h-4 w-4 mr-1" /> New invoice</Link>
            </Button>
          </div>
        }
      />
      {isAdmin && <BillingFinancialOverview />}

      {isLoading ? (
        <div className="grid gap-3">{Array.from({length:5}).map((_,i)=> <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (filtered.length === 0) ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-3">No invoices {modeFilter !== "all" ? `for ${modeFilter}` : "yet"}.</p>
          {modeFilter === "all" && (
            <Button asChild className="gradient-primary text-primary-foreground"><Link to="/billing/new">Create first invoice</Link></Button>
          )}
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((inv: any) => (
            <Link key={inv.id} to="/billing/$id" params={{ id: inv.id }}>
              <Card className="card-hover"><CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">#{inv.number}</span>
                    <Badge variant="outline" className={`capitalize ${statusColor[inv.status!] ?? ""}`}>{inv.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {inv.member?.full_name ?? "Walk-in"} · {fmtDate(inv.issued_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{fmtCurrency(inv.total)}</div>
                  {Number(inv.amount_paid) < Number(inv.total) && (
                    <div className="text-xs text-destructive">Due {fmtCurrency(Number(inv.total) - Number(inv.amount_paid))}</div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  title="Share invoice"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const [{ data: full }, { data: items }, { data: pays }] = await Promise.all([
                      supabase.from("invoices").select("*, members(full_name, phone)").eq("id", inv.id).single(),
                      supabase.from("invoice_items").select("*").eq("invoice_id", inv.id),
                      supabase.from("payments").select("mode").eq("invoice_id", inv.id).is("deleted_at", null),
                    ]);
                    const { data: gym } = await supabase.from("gym_settings").select("*").maybeSingle();
                    if (!full) return;
                    const args = {
                      invoice: full as any,
                      items: (items ?? []) as any,
                      member: (full as any).members ?? null,
                      gym: gym as any,
                      paymentMethods: (pays ?? []).map((p: any) => p.mode),
                    };
                    const shared = await shareInvoicePdfFile(args);
                    if (!shared) {
                      downloadInvoicePdf(args);
                      toast.message("Sharing not supported — downloaded PDF instead.");
                    }
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  title="Print invoice"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const [{ data: full }, { data: items }, { data: pays }] = await Promise.all([
                      supabase.from("invoices").select("*, members(full_name, phone)").eq("id", inv.id).single(),
                      supabase.from("invoice_items").select("*").eq("invoice_id", inv.id),
                      supabase.from("payments").select("mode").eq("invoice_id", inv.id).is("deleted_at", null),
                    ]);
                    const { data: gym } = await supabase.from("gym_settings").select("*").maybeSingle();
                    if (!full) return;
                    printInvoicePdf({
                      invoice: full as any,
                      items: (items ?? []) as any,
                      member: (full as any).members ?? null,
                      gym: gym as any,
                      paymentMethods: (pays ?? []).map((p: any) => p.mode),
                    });
                  }}
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
