import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtCurrency, fmtDate } from "./format";

export function downloadInvoicePdf(args: {
  invoice: { number: string; issued_at: string; subtotal: number; total: number; amount_paid: number; notes: string | null };
  items: Array<{ description: string; qty: number; unit_price: number; amount: number }>;
  member: { full_name?: string; phone?: string } | null;
  gym: { name?: string; address?: string | null; phone?: string | null; currency_symbol?: string } | null | undefined;
}) {
  const doc = generateInvoicePdf({
    gymName: args.gym?.name ?? "Fitness Dream",
    gymAddress: args.gym?.address ?? null,
    gymPhone: args.gym?.phone ?? null,
    currencySymbol: args.gym?.currency_symbol ?? "₹",
    number: args.invoice.number,
    issuedAt: args.invoice.issued_at,
    memberName: args.member?.full_name ?? "Walk-in",
    memberPhone: args.member?.phone ?? null,
    items: args.items,
    subtotal: Number(args.invoice.subtotal),
    total: Number(args.invoice.total),
    amountPaid: Number(args.invoice.amount_paid),
    notes: args.invoice.notes,
  });
  doc.save(`invoice-${args.invoice.number}.pdf`);
}

type Item = { description: string; qty: number; unit_price: number; amount: number };

export type InvoicePdfInput = {
  gymName: string;
  gymAddress?: string | null;
  gymPhone?: string | null;
  currencySymbol: string;
  number: string;
  issuedAt: string;
  memberName: string;
  memberPhone?: string | null;
  items: Item[];
  subtotal: number;
  total: number;
  amountPaid: number;
  notes?: string | null;
};

export function generateInvoicePdf(inv: InvoicePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(255, 90, 31);
  doc.rect(0, 0, pw, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(inv.gymName, 40, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (inv.gymAddress) doc.text(inv.gymAddress, 40, 62);
  if (inv.gymPhone) doc.text(inv.gymPhone, 40, 76);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("INVOICE", pw - 40, 45, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`#${inv.number}`, pw - 40, 62, { align: "right" });
  doc.text(fmtDate(inv.issuedAt), pw - 40, 76, { align: "right" });

  // Billed To
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Billed To", 40, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(inv.memberName, 40, 148);
  if (inv.memberPhone) doc.text(inv.memberPhone, 40, 164);

  autoTable(doc, {
    startY: 195,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: inv.items.map((i) => [
      i.description,
      String(i.qty),
      fmtCurrency(i.unit_price, inv.currencySymbol),
      fmtCurrency(i.amount, inv.currencySymbol),
    ]),
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [255, 90, 31], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  const afterY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 250;
  const balance = Math.max(0, inv.total - inv.amountPaid);
  const rightX = pw - 40;
  let y = afterY + 24;
  doc.setFontSize(11);
  doc.text("Subtotal", rightX - 140, y);
  doc.text(fmtCurrency(inv.subtotal, inv.currencySymbol), rightX, y, { align: "right" });
  y += 18;
  doc.text("Total", rightX - 140, y);
  doc.setFont("helvetica", "bold");
  doc.text(fmtCurrency(inv.total, inv.currencySymbol), rightX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 18;
  doc.text("Paid", rightX - 140, y);
  doc.text(fmtCurrency(inv.amountPaid, inv.currencySymbol), rightX, y, { align: "right" });
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(balance > 0 ? 200 : 0, 60, 30);
  doc.text("Balance Due", rightX - 140, y);
  doc.text(fmtCurrency(balance, inv.currencySymbol), rightX, y, { align: "right" });
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");

  if (inv.notes) {
    doc.setFontSize(10);
    doc.text("Notes: " + inv.notes, 40, y + 40, { maxWidth: pw - 80 });
  }

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Thank you for training with us. Push harder. Live stronger.", pw / 2, doc.internal.pageSize.getHeight() - 30, { align: "center" });

  return doc;
}
