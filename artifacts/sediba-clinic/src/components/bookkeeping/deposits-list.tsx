import { useVoidBookDeposit, type BookDeposit } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatJhb, formatRand } from "@/lib/money";
import { VoidControl } from "./void-control";
import { useInvalidateBooks } from "./shared";

export function DepositsList({ deposits }: { deposits: BookDeposit[] }) {
  const { toast } = useToast();
  const invalidate = useInvalidateBooks();
  const voidDep = useVoidBookDeposit();

  const doVoid = (id: number) => (reason: string, done: () => void, fail: (e: unknown) => void) => {
    if (voidDep.isPending) return;
    voidDep.mutate({ id, data: { reason } }, {
      onSuccess: () => { done(); toast({ title: "Match undone", description: "Receipts released; audit record kept." }); invalidate(); },
      onError: fail,
    });
  };

  if (deposits.length === 0) return (
    <div className="p-10 text-center"><p className="font-serif text-lg">No deposit matches in this range.</p><p className="text-sm text-muted-foreground mt-1">Matches you record appear here by deposit date.</p></div>
  );

  return (
    <ul className="divide-y divide-border">
      {deposits.map((d) => {
        const isVoid = !!d.voidReason;
        return (
          <li key={d.id} className={`px-4 sm:px-6 py-4 ${isVoid ? "bg-muted/40" : ""}`} data-testid={`row-deposit-${d.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Deposit #{d.id} · {formatJhb(`${d.date}T12:00:00+02:00`, false)}</p>
                <p className={`text-sm font-mono mt-1 break-words ${isVoid ? "line-through text-muted-foreground" : ""}`}>{d.reference}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{d.receiptKeys.length} receipt(s): <span className="font-mono">{d.receiptKeys.join(", ")}</span></p>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-right font-mono text-xs">
                <div><dt className="text-[9px] uppercase tracking-widest text-muted-foreground font-sans">Bank</dt><dd>{formatRand(d.bankCents)}</dd></div>
                <div><dt className="text-[9px] uppercase tracking-widest text-muted-foreground font-sans">Fees</dt><dd>{formatRand(d.feeCents)}</dd></div>
                <div><dt className="text-[9px] uppercase tracking-widest text-muted-foreground font-sans">Gross</dt><dd>{formatRand(d.grossCents)}</dd></div>
              </dl>
            </div>
            <p className={`text-[10px] uppercase tracking-widest mt-2 ${isVoid ? "text-destructive" : "text-primary"}`} data-testid={`status-deposit-${d.id}`}>{isVoid ? `Unmatched · ${d.voidReason}` : "Active match"}</p>
            {!isVoid && (
              <VoidControl label="Unmatch deposit" pending={voidDep.isPending} onVoid={doVoid(d.id)} testId={`void-deposit-${d.id}`}
                explain="Unmatching releases these receipts back to the unmatched list and removes this deposit's fee from the cashbook. The record stays for audit. It does not move or refund any money." />
            )}
          </li>
        );
      })}
    </ul>
  );
}
