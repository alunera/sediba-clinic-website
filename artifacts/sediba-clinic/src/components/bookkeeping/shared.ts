import { useQueryClient } from "@tanstack/react-query";
import { getGetBookkeepingQueryKey, getGetProfitReportQueryKey, type BookRow } from "@workspace/api-client-react";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_RANGE_DAYS = 367;

export const CATEGORY_LABEL: Record<string, string> = {
  rent: "Rent", utilities: "Utilities", salaries: "Salaries", consumables: "Consumables",
  product_purchases: "Product purchases", marketing: "Marketing", transport: "Transport",
  bank_fees: "Bank fees", other: "Other",
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? (c ? c.replace(/_/g, " ") : "");

export const KIND_LABEL: Record<string, string> = { receipt: "Receipt", refund: "Refund", expense: "Expense", fee: "Deposit fee" };

/** Signed cash effect of a row (receipts in, everything else out). */
export const signed = (r: BookRow) => (r.kind === "receipt" ? r.amountCents : -r.amountCents);

export function rowStatus(r: BookRow): string {
  if (r.voidReason) return "Void";
  if (r.kind === "receipt" && r.depositId != null) return `Matched to deposit #${r.depositId}`;
  if (r.kind === "fee" && r.depositId != null) return `Fee of deposit #${r.depositId}`;
  return "Active";
}

export function keyId(key: string, prefix: string): number | null {
  if (!key.startsWith(prefix + ":")) return null;
  const n = Number(key.slice(prefix.length + 1));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function useInvalidateBooks() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [getGetProfitReportQueryKey()[0]] });
    return qc.invalidateQueries({ queryKey: [getGetBookkeepingQueryKey()[0]] });
  };
}

export const inputCls = "w-full bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60";
export const labelCls = "text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5";
export const btnPrimary = "inline-flex items-center justify-center gap-2 text-xs uppercase tracking-widest bg-primary text-primary-foreground px-5 py-3 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed";
export const btnGhost = "inline-flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest border border-border px-3 py-2 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";
