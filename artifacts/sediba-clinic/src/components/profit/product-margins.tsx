import { AlertTriangle, Package } from "lucide-react";
import type { ProfitReport } from "@workspace/api-client-react";
import { formatRand } from "@/lib/money";

const margin = (c: number | null) => c === null ? <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Unavailable</span> : <span className={c < 0 ? "text-destructive" : ""}>{c < 0 ? "-" : ""}{formatRand(Math.abs(c))}</span>;

export function RefundWarning({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="border border-amber-600/50 bg-amber-500/10 p-4 flex gap-3 text-sm" role="status" data-testid="text-refunded-sale-warning">
      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-800" aria-hidden="true" />
      <p><b>{count} {count === 1 ? "sale" : "sales"} in this range had refunds.</b> Refunds are not allocated to individual items, so the margins below are before refunds. Do not read them as net product profit.</p>
    </div>
  );
}

export function ProductMargins({ r }: { r: ProfitReport }) {
  const incomplete = r.missingCostUnits > 0;
  const totalMargin = incomplete ? null : r.productSalesCents - r.knownProductCostCents;
  return (
    <section className="min-w-0 w-full bg-card border border-border" aria-label="Product gross margin">
      <div className="p-5 sm:p-6 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sale date, before refunds</p>
        <h2 className="font-serif text-xl mt-1">Product gross margin</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">Retail product lines on sales created in this range, paid or unpaid. Voided sales excluded. Cost is the per-unit cost snapshotted at the time of sale. Not cash income and not net profit.</p>
      </div>
      {r.products.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center text-muted-foreground"><Package className="w-5 h-5" /></div>
          <p className="font-serif text-lg">No product sales in this range.</p>
          <p className="text-sm text-muted-foreground">Treatment-only sales do not appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="p-3 sm:px-6 font-normal">Product</th><th className="p-3 font-normal text-right">Qty</th><th className="p-3 font-normal text-right">Gross sale value</th><th className="p-3 font-normal text-right">Known cost</th><th className="p-3 font-normal text-right">Units missing cost</th><th className="p-3 sm:px-6 font-normal text-right">Gross margin</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {r.products.map((p) => (
                <tr key={p.key} data-testid={`row-product-margin-${p.key}`}>
                  <td className="p-3 sm:px-6">{p.name}</td>
                  <td className="p-3 text-right font-mono">{p.quantity}</td>
                  <td className="p-3 text-right font-mono">{formatRand(p.salesCents)}</td>
                  <td className="p-3 text-right font-mono">{formatRand(p.knownCostCents)}</td>
                  <td className={`p-3 text-right font-mono ${p.missingCostUnits ? "text-amber-800" : "text-muted-foreground"}`}>{p.missingCostUnits}</td>
                  <td className="p-3 sm:px-6 text-right font-mono">{margin(p.grossMarginCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-border font-medium">
              <td className="p-3 sm:px-6">Totals</td><td />
              <td className="p-3 text-right font-mono" data-testid="text-product-sales-total">{formatRand(r.productSalesCents)}</td>
              <td className="p-3 text-right font-mono" data-testid="text-known-cost-total">{formatRand(r.knownProductCostCents)}{incomplete && <span className="block text-[10px] uppercase tracking-widest text-amber-800">Incomplete</span>}</td>
              <td className="p-3 text-right font-mono" data-testid="text-missing-units-total">{r.missingCostUnits}</td>
              <td className="p-3 sm:px-6 text-right font-mono" data-testid="text-margin-total">{margin(totalMargin)}</td>
            </tr></tfoot>
          </table>
        </div>
      )}
      {incomplete && <p className="px-5 sm:px-6 py-3 border-t border-border text-xs text-amber-800" data-testid="text-missing-cost-note">{r.missingCostUnits} sold {r.missingCostUnits === 1 ? "unit has" : "units have"} no recorded cost, so known cost is incomplete and total margin is unavailable. Unknown cost is never treated as zero.</p>}
    </section>
  );
}
