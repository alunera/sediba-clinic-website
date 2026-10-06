import { useMemo, useRef, useState, type FormEvent } from "react";
import { useCreateBookDeposit, type BookRow } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { createIdempotencyKeeper, errMsg, formatJhb, formatRand, jhbToday, methodLabel, parseRandToCents } from "@/lib/money";
import { DATE_RE, btnGhost, btnPrimary, inputCls, labelCls, useInvalidateBooks } from "./shared";

export function DepositMatch({ unmatched }: { unmatched: BookRow[] }) {
  const today = jhbToday();
  const { toast } = useToast();
  const invalidate = useInvalidateBooks();
  const keeper = useRef(createIdempotencyKeeper());
  const create = useCreateBookDeposit();
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [fee, setFee] = useState("0");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending;

  const eligible = useMemo(() => unmatched.filter((r) => r.kind === "receipt" && r.amountCents > 0 && !r.voidReason && r.depositId == null), [unmatched]);
  const byKey = useMemo(() => new Map(eligible.map((r) => [r.key, r])), [eligible]);
  const chosen = selected.map((k) => byKey.get(k)).filter((r): r is BookRow => !!r);
  const stale = selected.length - chosen.length;
  const gross = chosen.reduce((s, r) => s + r.amountCents, 0);
  const latest = chosen.reduce((m, r) => (r.date > m ? r.date : m), "");
  const bankC = parseRandToCents(bank);
  const feeC = fee.trim() === "" ? 0 : parseRandToCents(fee);
  const diff = bankC !== null && feeC !== null ? gross - bankC - feeC : null;

  const toggle = (k: string) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (stale > 0) return setError("Some selected receipts are no longer unmatched (matched elsewhere or voided). Clear and reselect.");
    if (chosen.length === 0) return setError("Select at least one receipt that the bank deposit covers.");
    if (chosen.length > 200) return setError("A single match can cover at most 200 receipts.");
    if (!DATE_RE.test(date)) return setError("Choose the date the deposit reached the bank.");
    if (date > jhbToday()) return setError("The deposit date cannot be in the future.");
    if (date < latest) return setError(`The deposit date must be on or after the latest selected receipt (${latest}).`);
    if (!reference.trim()) return setError("Enter the bank statement reference.");
    if (bankC === null || bankC < 1) return setError("Enter the amount that arrived in the bank.");
    if (feeC === null) return setError("Enter a valid fee amount, or 0.");
    if (bankC + feeC !== gross) return setError(`Bank amount plus fees must equal the selected receipts (${formatRand(gross)}). Difference: ${formatRand(gross - bankC - feeC)}.`);
    if (!verified) return setError("Confirm you have checked this deposit on the bank statement.");
    setError(null);
    const body = { date, reference: reference.trim(), bankCents: bankC, feeCents: feeC, receiptKeys: [...selected].sort(), verified: true as const };
    const requestId = keeper.current.get(body);
    create.mutate({ data: { requestId, ...body } }, {
      onSuccess: () => {
        keeper.current.reset();
        setSelected([]); setReference(""); setBank(""); setFee("0"); setVerified(false);
        toast({ title: "Deposit matched", description: `${chosen.length} receipt(s), ${formatRand(gross)} gross` });
        invalidate();
      },
      onError: (err) => setError(`${errMsg(err)} Your selection is kept; retrying sends the same request and will not duplicate it.`),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="bg-card border border-border" aria-label="Match bank deposit" data-testid="form-deposit">
      <div className="p-4 sm:p-6 border-b border-border">
        <h2 className="font-serif text-xl">Match a bank deposit</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Tick the receipts a deposit covers, then enter what arrived and any fee withheld. This reconciles existing receipts; it is not new income and does not connect to the bank or Yoco. Each receipt belongs to one match, in full. Do not enter a fee here if you already recorded it as an expense.</p>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-border" data-testid="list-unmatched">
        {eligible.length === 0 ? (
          <div className="p-8 text-center"><p className="font-serif text-lg">Every receipt is matched.</p><p className="text-xs text-muted-foreground mt-1">New receipts from sales and bookings appear here automatically, from any date.</p></div>
        ) : eligible.map((r) => {
          const on = selected.includes(r.key);
          return (
            <label key={r.key} className={`flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer text-sm transition-colors ${on ? "bg-primary/10" : "hover:bg-muted/50"}`} data-testid={`row-unmatched-${r.key}`}>
              <input type="checkbox" checked={on} disabled={pending} onChange={() => toggle(r.key)} className="accent-[hsl(var(--primary))]" data-testid={`checkbox-receipt-${r.key}`} />
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{formatJhb(`${r.date}T12:00:00+02:00`, false)}</span>
              <span className="flex-1 min-w-0"><span className="block truncate">{r.description}</span><span className="block text-[11px] text-muted-foreground font-mono truncate">{r.reference} · {methodLabel(r.method)}</span></span>
              <span className="font-mono whitespace-nowrap">{formatRand(r.amountCents)}</span>
            </label>
          );
        })}
      </div>
      <div className="p-4 sm:p-6 border-t border-border space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm"><span className="text-muted-foreground">{chosen.length} selected · gross </span><span className="font-mono font-medium" data-testid="text-deposit-gross">{formatRand(gross)}</span></p>
          {selected.length > 0 && <button type="button" disabled={pending} onClick={() => setSelected([])} className={btnGhost} data-testid="button-clear-selection">Clear</button>}
        </div>
        {stale > 0 && <p className="text-xs text-destructive" role="alert">{stale} selected receipt(s) were matched or voided since you picked them.</p>}
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="dp-date" className={labelCls}>Deposit date</label>
            <input id="dp-date" type="date" value={date} min={latest || undefined} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} data-testid="input-deposit-date" /></div>
          <div><label htmlFor="dp-ref" className={labelCls}>Statement reference</label>
            <input id="dp-ref" value={reference} maxLength={200} onChange={(e) => setReference(e.target.value)} className={inputCls} data-testid="input-deposit-reference" /></div>
          <div><label htmlFor="dp-bank" className={labelCls}>Arrived in bank (R)</label>
            <input id="dp-bank" inputMode="decimal" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="0.00" className={`${inputCls} font-mono`} data-testid="input-deposit-bank" /></div>
          <div><label htmlFor="dp-fee" className={labelCls}>Fees withheld (R)</label>
            <div className="flex gap-2">
              <input id="dp-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} className={`${inputCls} font-mono`} data-testid="input-deposit-fee" />
              <button type="button" className={btnGhost} disabled={bankC === null || bankC > gross} onClick={() => bankC !== null && setFee(((gross - bankC) / 100).toFixed(2))} data-testid="button-fill-fee">Balance</button>
            </div></div>
        </fieldset>
        {diff !== null && chosen.length > 0 && (
          <p className={`text-xs font-mono ${diff === 0 ? "text-primary" : "text-destructive"}`} data-testid="text-deposit-diff">{diff === 0 ? "Balanced: bank + fees = gross" : `Out by ${formatRand(diff)}`}</p>
        )}
        <label className="flex items-start gap-3 text-sm border border-border p-3 cursor-pointer">
          <input type="checkbox" checked={verified} disabled={pending} onChange={(e) => setVerified(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" data-testid="checkbox-deposit-verified" />
          <span>I have checked this deposit on the <b>bank statement</b> myself.</span>
        </label>
        {error && <p className="text-xs text-destructive" role="alert" data-testid="error-deposit">{error}</p>}
        <button type="submit" disabled={pending || eligible.length === 0} className={btnPrimary} data-testid="button-submit-deposit">{pending ? "Matching..." : "Record match"}</button>
      </div>
    </form>
  );
}
