import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { Plus, Receipt } from "lucide-react";

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
  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_no, total, amount_paid, status, issued_at, members(full_name, phone)")
        .order("issued_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Invoices and payments."
        actions={
          <Button asChild className="gradient-primary text-primary-foreground">
            <Link to="/billing/new"><Plus className="h-4 w-4 mr-1" /> New invoice</Link>
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid gap-3">{Array.from({length:5}).map((_,i)=> <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-3">No invoices yet.</p>
          <Button asChild className="gradient-primary text-primary-foreground"><Link to="/billing/new">Create first invoice</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {data!.map((inv) => (
            <Link key={inv.id} to="/billing/$id" params={{ id: inv.id }}>
              <Card className="card-hover"><CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">#{inv.invoice_no}</span>
                    <Badge variant="outline" className={`capitalize ${statusColor[inv.status!] ?? ""}`}>{inv.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(inv.members as { full_name?: string; phone?: string } | null)?.full_name ?? "Walk-in"} · {fmtDate(inv.issued_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{fmtCurrency(inv.total)}</div>
                  {Number(inv.amount_paid) < Number(inv.total) && (
                    <div className="text-xs text-destructive">Due {fmtCurrency(Number(inv.total) - Number(inv.amount_paid))}</div>
                  )}
                </div>
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
