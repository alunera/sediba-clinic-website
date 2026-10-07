import { csvCell } from "@/lib/money";
import type { ProfitReport } from "@workspace/api-client-react";

export const CATEGORY_LABEL: Record<string, string> = {
  rent: "Rent", utilities: "Utilities", salaries: "Salaries", consumables: "Consumables",
  product_purchases: "Product purchases", marketing: "Marketing", transport: "Transport",
  bank_fees: "Bank and deposit fees", other: "Other",
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c.replace(/_/g, " ");

const money = (cents: number) => `"${(cents / 100).toFixed(2)}"`;
const row = (label: string, ...vals: string[]) => [csvCell(label), ...vals].join(",");

export function downloadProfitCsv(r: ProfitReport) {
  const L: string[] = [
    row(`Sediba profit report ${r.from} to ${r.to} (Johannesburg, cash basis)`), "",
    row("CASH PROFIT AND LOSS"), row("Line", csvCell("Amount (ZAR)")),
    row("Receipts", money(r.receivedCents)), row("Refunds", money(-r.refundedCents)),
    row("Net receipts", money(r.netReceiptsCents)),
  ];
  for (const e of r.expenses) L.push(row(`Paid expense: ${categoryLabel(e.category)}`, money(-e.amountCents)));
  L.push(row("Total paid expenses", money(-r.expenseCents)), row("Cash profit", money(r.cashProfitCents)), "",
    row("PRODUCT GROSS MARGIN (sale date, before refunds; not cash income, not net profit)"),
    row("Product", csvCell("Quantity"), csvCell("Gross sale value (ZAR)"), csvCell("Known cost (ZAR)"), csvCell("Units missing cost"), csvCell("Gross margin (ZAR)")));
  for (const p of r.products) L.push(row(p.name, `"${p.quantity}"`, money(p.salesCents), money(p.knownCostCents), `"${p.missingCostUnits}"`, p.grossMarginCents === null ? csvCell("Unavailable") : money(p.grossMarginCents)));
  L.push(row("Totals", '""', money(r.productSalesCents), money(r.knownProductCostCents), `"${r.missingCostUnits}"`, r.missingCostUnits > 0 ? csvCell("Unavailable (incomplete cost)") : money(r.productSalesCents - r.knownProductCostCents)),
    row("Sales in range with refunds (not allocated to items)", `"${r.refundedSaleCount}"`));
  const blob = new Blob(["\ufeff" + L.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `sediba-profit-${r.from}-to-${r.to}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
