import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtCurrency, fmtDate } from "./format";

type Item = { description: string; qty: number; unit_price: number; amount: number };

export type InvoicePdfInput = {
  gymName: string;
  gymTagline?: string | null;
  gymAddress?: string | null;
  gymPhone?: string | null;
  gymEmail?: string | null;
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
  terms?: string | null;
  paymentMethods?: string[];
};

export function downloadInvoicePdf(args: {
  invoice: { number: string; issued_at: string; subtotal: number; total: number; amount_paid: number; notes: string | null };
  items: Array<{ description: string; qty: number; unit_price: number; amount: number }>;
  member: { full_name?: string; phone?: string } | null;
  gym: {
    name?: string; tagline?: string | null; address?: string | null; phone?: string | null;
    email?: string | null; currency_symbol?: string; invoice_terms?: string | null;
  } | null | undefined;
  paymentMethods?: string[];
}) {
  const doc = generateInvoicePdf({
    gymName: args.gym?.name ?? "Fitness Dream",
    gymTagline: args.gym?.tagline ?? null,
    gymAddress: args.gym?.address ?? null,
    gymPhone: args.gym?.phone ?? null,
    gymEmail: args.gym?.email ?? null,
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
    terms: args.gym?.invoice_terms ?? null,
    paymentMethods: args.paymentMethods,
  });
  doc.save(`invoice-${args.invoice.number}.pdf`);
}

// Brand palette
const ORANGE: [number, number, number] = [255, 90, 31];
const ORANGE_DEEP: [number, number, number] = [214, 64, 12];
const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const HAIRLINE: [number, number, number] = [228, 228, 231];
const CARD_BG: [number, number, number] = [250, 250, 250];
const SUCCESS: [number, number, number] = [22, 143, 79];
const DANGER: [number, number, number] = [200, 45, 30];

function drawLogo(doc: jsPDF, x: number, y: number, size: number) {
  // Orange rounded square with white dumbbell mark
  doc.setFillColor(...ORANGE);
  doc.roundedRect(x, y, size, size, 6, 6, "F");
  // subtle darker corner
  doc.setFillColor(...ORANGE_DEEP);
  doc.roundedRect(x, y + size * 0.6, size, size * 0.4, 6, 6, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(x, y + size * 0.6, size, size * 0.15, "F");
  // dumbbell glyph
  doc.setFillColor(255, 255, 255);
  const cy = y + size / 2;
  const barW = size * 0.5;
  const barH = size * 0.12;
  doc.rect(x + (size - barW) / 2, cy - barH / 2, barW, barH, "F");
  const wW = size * 0.14;
  const wH = size * 0.36;
  doc.roundedRect(x + size * 0.12, cy - wH / 2, wW, wH, 1.5, 1.5, "F");
  doc.roundedRect(x + size - size * 0.12 - wW, cy - wH / 2, wW, wH, 1.5, 1.5, "F");
}

export function generateInvoicePdf(inv: InvoicePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 42; // side margin

  // ---------- Header (clean, not a flat block) ----------
  const logoSize = 44;
  drawLogo(doc, M, 40, logoSize);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(inv.gymName, M + logoSize + 14, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  if (inv.gymTagline) doc.text(inv.gymTagline, M + logoSize + 14, 76);

  // Right side: INVOICE label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ORANGE);
  doc.text("INVOICE", pw - M, 52, { align: "right" });
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`#${inv.number}`, pw - M, 70, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Issued ${fmtDate(inv.issuedAt)}`, pw - M, 84, { align: "right" });

  // Accent hairline under header
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1.5);
  doc.line(M, 100, pw - M, 100);
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.5);
  doc.line(M, 103, pw - M, 103);

  // ---------- Billed To / From ----------
  const infoTop = 124;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("BILLED TO", M, infoTop);
  doc.text("FROM", pw / 2 + 10, infoTop);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(inv.memberName, M, infoTop + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  if (inv.memberPhone) doc.text(inv.memberPhone, M, infoTop + 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(inv.gymName, pw / 2 + 10, infoTop + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  let fromY = infoTop + 30;
  if (inv.gymAddress) {
    const lines = doc.splitTextToSize(inv.gymAddress, pw / 2 - M - 10);
    doc.text(lines, pw / 2 + 10, fromY);
    fromY += lines.length * 11;
  }
  if (inv.gymPhone) { doc.text(inv.gymPhone, pw / 2 + 10, fromY); fromY += 11; }
  if (inv.gymEmail) { doc.text(inv.gymEmail, pw / 2 + 10, fromY); fromY += 11; }

  // ---------- Items table ----------
  const tableStart = Math.max(infoTop + 68, fromY + 14);
  autoTable(doc, {
    startY: tableStart,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: inv.items.map((i) => [
      i.description,
      String(i.qty),
      fmtCurrency(i.unit_price, inv.currencySymbol),
      fmtCurrency(i.amount, inv.currencySymbol),
    ]),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: { top: 9, right: 10, bottom: 9, left: 10 }, textColor: INK, lineColor: HAIRLINE, lineWidth: 0.5 },
    headStyles: {
      fillColor: [245, 245, 244], textColor: INK, fontStyle: "bold", fontSize: 9,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 10 }, lineColor: HAIRLINE, lineWidth: 0.5,
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 50 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90, fontStyle: "bold" },
    },
    margin: { left: M, right: M },
  });

  const afterY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStart + 40;

  // ---------- Totals card ----------
  const balance = Math.max(0, inv.total - inv.amountPaid);
  const isPaid = balance <= 0.001;
  const cardW = 260;
  const cardX = pw - M - cardW;
  const cardY = afterY + 18;
  const cardH = 118;

  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.75);
  doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "FD");

  const labelX = cardX + 16;
  const valX = cardX + cardW - 16;
  let ty = cardY + 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Subtotal", labelX, ty);
  doc.setTextColor(...INK);
  doc.text(fmtCurrency(inv.subtotal, inv.currencySymbol), valX, ty, { align: "right" });

  ty += 18;
  doc.setTextColor(...MUTED);
  doc.text("Total", labelX, ty);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text(fmtCurrency(inv.total, inv.currencySymbol), valX, ty, { align: "right" });

  ty += 18;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Amount paid", labelX, ty);
  doc.setTextColor(...INK);
  doc.text(fmtCurrency(inv.amountPaid, inv.currencySymbol), valX, ty, { align: "right" });

  // divider inside card
  ty += 10;
  doc.setDrawColor(...HAIRLINE);
  doc.line(labelX, ty, valX, ty);

  ty += 22;
  const balColor = isPaid ? SUCCESS : DANGER;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(isPaid ? "Paid in full" : "Balance due", labelX, ty);
  doc.setFontSize(16);
  doc.setTextColor(...balColor);
  doc.text(
    isPaid ? fmtCurrency(0, inv.currencySymbol) : fmtCurrency(balance, inv.currencySymbol),
    valX, ty, { align: "right" }
  );

  // Status pill on the left of totals
  const pillW = 78; const pillH = 22;
  const pillX = M; const pillY = cardY + 6;
  doc.setFillColor(...(isPaid ? SUCCESS : DANGER));
  doc.roundedRect(pillX, pillY, pillW, pillH, 11, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(isPaid ? "PAID" : "UNPAID", pillX + pillW / 2, pillY + 14, { align: "center" });

  // Notes (left column, below status)
  let leftY = pillY + pillH + 16;
  if (inv.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("NOTES", M, leftY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const noteLines = doc.splitTextToSize(inv.notes, cardX - M - 20);
    doc.text(noteLines, M, leftY + 12);
    leftY += 12 + noteLines.length * 11;
  }

  if (inv.paymentMethods && inv.paymentMethods.length) {
    const labelMap: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank Transfer", other: "Other", unknown: "Other" };
    const uniq = Array.from(new Set(inv.paymentMethods.map(m => labelMap[m] ?? m)));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("PAYMENT METHOD", M, leftY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(uniq.join(", "), M, leftY + 12);
    leftY += 24;
  }

  // ---------- Terms & Conditions ----------
  const afterTotals = Math.max(cardY + cardH, leftY) + 24;
  const footerH = 46;
  const termsMaxY = ph - footerH - 20;
  let termsY = afterTotals;

  if (inv.terms && inv.terms.trim()) {
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.5);
    doc.line(M, termsY - 12, pw - M, termsY - 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("TERMS & CONDITIONS", M, termsY);
    termsY += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const termLines = doc.splitTextToSize(inv.terms, pw - M * 2);
    // clip if would overflow footer
    const maxLines = Math.max(0, Math.floor((termsMaxY - termsY) / 10));
    const shown = termLines.slice(0, maxLines);
    doc.text(shown, M, termsY);
  }

  // ---------- Footer ----------
  const fy = ph - footerH;
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1);
  doc.line(M, fy, pw - M, fy);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Thank you for training with us!", M, fy + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const contactBits = [inv.gymPhone, inv.gymEmail, inv.gymAddress].filter(Boolean) as string[];
  if (contactBits.length) {
    doc.text(contactBits.join("  •  "), pw - M, fy + 16, { align: "right" });
  }
  doc.setTextColor(...MUTED);
  doc.setFontSize(7.5);
  doc.text(
    `${inv.gymName} • Invoice ${inv.number} • ${fmtDate(inv.issuedAt)}`,
    M, fy + 30
  );

  return doc;
}
