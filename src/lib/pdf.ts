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

export function printInvoicePdf(args: Parameters<typeof downloadInvoicePdf>[0]) {
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
  doc.autoPrint();
  const url = doc.output("bloburl");
  const w = window.open(url, "_blank");
  if (!w) {
    // Popup blocked — fall back to same-tab navigation
    window.location.href = url as unknown as string;
  }
}

/**
 * Try to share the invoice PDF as a real file via Web Share API.
 * Returns true when the native share panel was invoked (or user cancelled it),
 * false when the browser cannot share files — caller should run fallback.
 */
export async function shareInvoicePdfFile(
  args: Parameters<typeof downloadInvoicePdf>[0]
): Promise<boolean> {
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
  const blob = doc.output("blob");
  const filename = `invoice-${args.invoice.number}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean }) : null;
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  const shareData: ShareData = {
    files: [file],
    title: `Invoice ${args.invoice.number}`,
    text: `Invoice ${args.invoice.number}`,
  };
  if (!nav.canShare(shareData)) return false;
  try {
    await nav.share(shareData);
    return true;
  } catch (e: unknown) {
    // AbortError means user dismissed the share sheet — treat as handled.
    if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "AbortError") return true;
    return false;
  }
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

// jsPDF's built-in helvetica (WinAnsi) has no glyph for ₹ (U+20B9) — it renders
// as a superscript "1". Replace with an ASCII-safe token so amounts render
// correctly and columns don't truncate.
function pdfCurrency(amount: number, symbol: string): string {
  const safe = symbol === "₹" ? "Rs. " : symbol;
  const n = Number(amount ?? 0);
  if (!isFinite(n)) return `${safe}0`;
  return `${safe}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function generateInvoicePdf(inv: InvoicePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 42;
  const cur = (n: number) => pdfCurrency(n, inv.currencySymbol);

  // ---------- Header ----------
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

  // Right: INVOICE label + number + status pill
  const balance = Math.max(0, inv.total - inv.amountPaid);
  const isPaid = balance <= 0.001;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE);
  doc.text("INVOICE", pw - M, 52, { align: "right" });
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`#${inv.number}`, pw - M, 68, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Issued ${fmtDate(inv.issuedAt)}`, pw - M, 82, { align: "right" });

  // Status pill under issued date, right-aligned
  {
    const label = isPaid ? "PAID" : "UNPAID";
    const pillH = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const textW = doc.getTextWidth(label);
    const pillW = textW + 16;
    const pillX = pw - M - pillW;
    const pillY = 90;
    doc.setFillColor(...(isPaid ? SUCCESS : DANGER));
    doc.roundedRect(pillX, pillY, pillW, pillH, 8, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(label, pillX + pillW / 2, pillY + 11, { align: "center" });
  }

  // Accent hairline under header
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1.5);
  doc.line(M, 116, pw - M, 116);

  // ---------- Billed To / From ----------
  const infoTop = 138;
  const colGap = 20;
  const colW = (pw - M * 2 - colGap) / 2;
  const rightX = M + colW + colGap;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("BILLED TO", M, infoTop);
  doc.text("FROM", rightX, infoTop);

  // Billed to
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(inv.memberName, M, infoTop + 16);
  let leftY = infoTop + 30;
  if (inv.memberPhone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(inv.memberPhone, M, leftY);
    leftY += 12;
  }

  // From
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(inv.gymName, rightX, infoTop + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  let fromY = infoTop + 30;
  if (inv.gymAddress) {
    const lines = doc.splitTextToSize(inv.gymAddress, colW);
    doc.text(lines, rightX, fromY);
    fromY += lines.length * 12;
  }
  if (inv.gymPhone) { doc.text(inv.gymPhone, rightX, fromY); fromY += 12; }
  if (inv.gymEmail) { doc.text(inv.gymEmail, rightX, fromY); fromY += 12; }

  // ---------- Items table ----------
  const tableStart = Math.max(leftY, fromY) + 18;
  autoTable(doc, {
    startY: tableStart,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: inv.items.map((i) => [
      i.description,
      String(i.qty),
      cur(i.unit_price),
      cur(i.amount),
    ]),
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: { top: 10, right: 10, bottom: 10, left: 10 },
      textColor: INK,
      lineColor: HAIRLINE,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: [250, 250, 250],
      textColor: MUTED,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
      lineColor: HAIRLINE,
      lineWidth: 0,
    },
    bodyStyles: { lineColor: HAIRLINE, lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 } as unknown as number },
    columnStyles: {
      0: { cellWidth: "auto", halign: "left" },
      1: { halign: "center", cellWidth: 46 },
      2: { halign: "right", cellWidth: 110 },
      3: { halign: "right", cellWidth: 110, fontStyle: "bold" },
    },
    margin: { left: M, right: M },
    didDrawCell: (data) => {
      // subtle underline under header row only
      if (data.section === "head") {
        const { x, y, height, width } = data.cell;
        doc.setDrawColor(...HAIRLINE);
        doc.setLineWidth(0.75);
        doc.line(x, y + height, x + width, y + height);
      }
    },
  });

  const afterY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStart + 40;

  // ---------- Totals card (right-aligned) ----------
  const cardW = 250;
  const cardX = pw - M - cardW;
  const cardY = afterY + 18;
  const cardH = 116;

  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.75);
  doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "FD");

  const labelX = cardX + 16;
  const valX = cardX + cardW - 16;
  let ty = cardY + 22;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(label, labelX, ty);
    doc.setTextColor(...INK);
    if (bold) doc.setFont("helvetica", "bold");
    doc.text(value, valX, ty, { align: "right" });
  };
  totalRow("Subtotal", cur(inv.subtotal));
  ty += 17;
  totalRow("Total", cur(inv.total), true);
  ty += 17;
  totalRow("Amount paid", cur(inv.amountPaid));

  ty += 10;
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.5);
  doc.line(labelX, ty, valX, ty);

  ty += 20;
  const balColor = isPaid ? SUCCESS : DANGER;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(isPaid ? "Paid in full" : "Balance due", labelX, ty);
  doc.setFontSize(15);
  doc.setTextColor(...balColor);
  doc.text(isPaid ? cur(0) : cur(balance), valX, ty, { align: "right" });

  // Left column beside totals: notes + payment method
  let sideY = cardY + 8;
  const sideMaxW = cardX - M - 20;
  if (inv.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("NOTES", M, sideY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const noteLines = doc.splitTextToSize(inv.notes, sideMaxW);
    doc.text(noteLines, M, sideY + 12);
    sideY += 14 + noteLines.length * 11;
  }
  if (inv.paymentMethods && inv.paymentMethods.length) {
    const labelMap: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank Transfer", other: "Other", unknown: "Other" };
    const uniq = Array.from(new Set(inv.paymentMethods.map(m => labelMap[m] ?? m)));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("PAYMENT METHOD", M, sideY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(uniq.join(", "), M, sideY + 12);
  }

  // ---------- Terms & Conditions (flows right after totals) ----------
  let termsY = cardY + cardH + 26;

  const footerH = 44;
  const footerReserved = footerH + 18; // gap before footer
  const termsMaxY = ph - footerReserved;

  if (inv.terms && inv.terms.trim()) {
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.5);
    doc.line(M, termsY - 14, pw - M, termsY - 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("TERMS & CONDITIONS", M, termsY);
    termsY += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const termLines = doc.splitTextToSize(inv.terms, pw - M * 2);
    const lineH = 10;
    const maxLines = Math.max(0, Math.floor((termsMaxY - termsY) / lineH));
    const shown = termLines.slice(0, maxLines);
    doc.text(shown, M, termsY, { lineHeightFactor: 1.35 });
    termsY += shown.length * lineH;
  }

  // ---------- Footer (positioned right after terms, not page-bottom anchored) ----------
  const fy = Math.min(ph - footerH, termsY + 18);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1);
  doc.line(M, fy, pw - M, fy);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Thank you for training with us!", M, fy + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const contactBits = [inv.gymPhone, inv.gymEmail].filter(Boolean) as string[];
  if (contactBits.length) {
    doc.text(contactBits.join("  •  "), pw - M, fy + 16, { align: "right" });
  }
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${inv.gymName} • Invoice ${inv.number} • ${fmtDate(inv.issuedAt)}`,
    M, fy + 30
  );

  return doc;
}
