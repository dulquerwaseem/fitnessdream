export function fmtCurrency(amount: number | string | null | undefined, symbol = "₹"): string {
  const n = Number(amount ?? 0);
  if (!isFinite(n)) return `${symbol}0`;
  return `${symbol}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function addMonthsISO(startISO: string, months: number): string {
  const d = new Date(startISO);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

/** Amounts entered are GST-inclusive. Split a gross amount into taxable value + GST. */
export function gstSplit(gross: number | string | null | undefined, rate = 18) {
  const total = Number(gross ?? 0);
  const taxable = Math.round((total / (1 + rate / 100)) * 100) / 100;
  const gst = Math.round((total - taxable) * 100) / 100;
  return { total, taxable, gst, rate };
}
