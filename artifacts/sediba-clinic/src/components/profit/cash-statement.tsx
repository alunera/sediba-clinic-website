import type { ProfitReport } from "@workspace/api-client-react";
import { formatRand } from "@/lib/money";
import { categoryLabel } from "./shared";

const signed = (c: number) => `${c < 0 ? "-" : ""}${formatRand(Math.abs(c))}`;

function Line({ label, cents, neg, strong, testId }: { label: string; cents: number; neg?: boolean; strong?: boolean; testId: string }) {
  return (
    <div className={`flex justify-between gap-4 px-5 sm:px-6 py-3 ${strong ? "border-t border-border font-medium" : ""}`}>
      <dt className="text-sm">{label}</dt>
      <dd className={`font-mono text-sm ${neg && cents > 0 ? "text-destructive" : ""}`} data-testid={testId}>{neg && cents > 0 ? "-" : ""}{formatRand(cents)}</dd>
    </div>
  );
}

export function CashStatement({ r }: { r: ProfitReport }) {
  const loss = r.cashProfitCents < 0;
  return (
    <section className="min-w-0 w-full bg-card border border-border" aria-label="Cash profit and loss">
      <div className="p-5 sm:p-6 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cash basis</p>
        <h2 className="font-serif text-xl mt-1">Profit and loss</h2>
        <p className="text-xs text-muted-foreground mt-1">Money actually received and paid out, dated by when it moved.</p>
      </div>
      <dl className="divide-y divide-border/60">
        <Line label="Receipts" cents={r.receivedCents} testId="text-profit-received" />
        <Line label="Refunds paid out" cents={r.refundedCents} neg testId="text-profit-refunded" />
        <Line label="Net receipts" cents={r.netReceiptsCents} strong testId="text-profit-net-receipts" />
        {r.expenses.length === 0 ? (
          <p className="px-5 sm:px-6 py-3 text-sm text-muted-foreground">No paid expenses in this range.</p>
        ) : r.expenses.map((e) => (
          <Line key={e.category} label={categoryLabel(e.category)} cents={e.amountCents} neg testId={`text-expense-${e.category}`} />
        ))}
        <Line label="Total paid expenses" cents={r.expenseCents} neg strong testId="text-profit-expenses" />
      </dl>
      <div className={`p-5 sm:p-6 ${loss ? "bg-destructive/10" : "bg-primary text-primary-foreground"}`}>
        <p className={`text-[10px] uppercase tracking-widest ${loss ? "text-destructive" : "opacity-80"}`}>{loss ? "Cash loss" : "Cash profit"}</p>
        <p className={`font-serif text-4xl mt-2 ${loss ? "text-destructive" : ""}`} data-testid="text-cash-profit">{signed(r.cashProfitCents)}</p>
        <p className={`text-[11px] mt-2 leading-relaxed ${loss ? "text-muted-foreground" : "opacity-80"}`}>Net receipts minus paid expenses. Product purchases are deducted once here, when paid; product costs from the margin table are not subtracted again. Bank deposits are not new income; matched deposit fees are included as expenses.</p>
      </div>
    </section>
  );
}
