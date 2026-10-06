import { useState } from "react";
import { useVoidBookExpense, type BookRow } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatJhb, formatRand, methodLabel } from "@/lib/money";
import { VoidControl } from "./void-control";
import { KIND_LABEL, categoryLabel, keyId, rowStatus, signed, useInvalidateBooks } from "./shared";

const FILTERS = ["all", "receipt", "refund", "expense", "fee", "void"] as const;
type Filter = (typeof FILTERS)[number];

export function Ledger({ rows }: { rows: BookRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { toast } = useToast();
  const invalidate = useInvalidateBooks();
  const voidExp = useVoidBookExpense();
  const shown = rows.filter((r) => filter === "all" ? true : filter === "void" ? !!r.voidReason : r.kind === filter);

  const doVoid = (id: number) => (reason: string, done: () => void, fail: (e: unknown) => void) => {
    if (voidExp.isPending) return;
    voidExp.mutate({ id, data: { reason } }, {
      onSuccess: () => { done(); toast({ title: "Expense voided", description: "Record kept with your reason." }); invalidate(); },
      onError: fail,
    });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 px-4 sm:px-6 py-3 border-b border-border">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`text-[10px] uppercase tracking-widest px-3 py-1.5 border ${filter === f ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`} data-testid={`button-filter-${f}`}>
            {f === "all" ? "All" : f === "void" ? "Voided" : KIND_LABEL[f]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="p-10 text-center"><p className="font-serif text-lg">No entries here.</p><p className="text-sm text-muted-foreground mt-1">Try another filter or widen the date range.</p></div>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((r) => {
            const expId = r.kind === "expense" ? keyId(r.key, "expense") : null;
            const isVoid = !!r.voidReason;
            const amt = signed(r);
            return (
              <li key={r.key} className={`px-4 sm:px-6 py-4 grid gap-2 sm:grid-cols-[88px_1fr_auto] sm:items-start ${isVoid ? "bg-muted/40" : ""}`} data-testid={`row-ledger-${r.key}`}>
                <span className="text-xs text-muted-foreground font-mono">{formatJhb(`${r.date}T12:00:00+02:00`, false)}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 ${r.kind === "receipt" ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>{KIND_LABEL[r.kind] ?? r.kind}</span>
                    <span className={`text-sm ${isVoid ? "line-through text-muted-foreground" : ""}`}>{r.description}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono break-words">
                    {[r.reference, categoryLabel(r.category), r.method ? methodLabel(r.method) : ""].filter(Boolean).join(" · ")}
                  </p>
                  <p className={`text-[10px] uppercase tracking-widest mt-1 ${isVoid ? "text-destructive" : "text-muted-foreground"}`} data-testid={`status-row-${r.key}`}>{rowStatus(r)}</p>
                  {isVoid && <p className="text-xs mt-1 text-muted-foreground">Reason: {r.voidReason}</p>}
                  {r.kind === "fee" && !isVoid && <p className="text-[11px] text-muted-foreground mt-1">To undo this fee, unmatch deposit #{r.depositId} below.</p>}
                  {expId !== null && !isVoid && (
                    <VoidControl label="Void expense" pending={voidExp.isPending} onVoid={doVoid(expId)} testId={`void-expense-${expId}`}
                      explain="Voiding marks this entry as recorded in error and removes it from totals. It does not reverse or refund any money. To correct it, void and then record a new expense." />
                  )}
                </div>
                <span className={`font-mono text-sm sm:text-right whitespace-nowrap ${isVoid ? "line-through text-muted-foreground" : amt < 0 ? "text-destructive" : ""}`}>{formatRand(amt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
