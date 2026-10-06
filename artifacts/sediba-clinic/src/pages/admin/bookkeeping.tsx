import { useState, type FormEvent } from "react";
import { AlertCircle, Download, Info } from "lucide-react";
import { useGetBookkeeping, getGetBookkeepingQueryKey, type Bookkeeping } from "@workspace/api-client-react";
import { csvCell, errMsg, formatJhb, formatRand, jhbToday, methodLabel } from "@/lib/money";
import { ExpenseForm } from "@/components/bookkeeping/expense-form";
import { DepositMatch } from "@/components/bookkeeping/deposit-match";
import { Ledger } from "@/components/bookkeeping/ledger";
import { DepositsList } from "@/components/bookkeeping/deposits-list";
import { DATE_RE, KIND_LABEL, MAX_RANGE_DAYS, btnGhost, btnPrimary, categoryLabel, daysBetween, inputCls, labelCls, rowStatus, signed } from "@/components/bookkeeping/shared";

const monthStart = (t: string) => `${t.slice(0, 8)}01`;
const money = (c: number) => `"${(c / 100).toFixed(2)}"`;

function exportCsv(b: Bookkeeping) {
  const lines = [["Date", "Key", "Type", "Description", "Reference", "Category", "Method", "Amount (ZAR, signed)", "Status", "Void reason", "Deposit ID"].map(csvCell).join(",")];
  for (const r of b.rows) {
    lines.push([r.date, r.key, KIND_LABEL[r.kind] ?? r.kind, r.description, r.reference, categoryLabel(r.category), r.method ? methodLabel(r.method) : "", "", rowStatus(r), r.voidReason, r.depositId ?? ""]
      .map((v, i) => (i === 7 ? money(signed(r)) : csvCell(v))).join(","));
  }
  lines.push("", [csvCell("Received"), money(b.receivedCents)].join(","), [csvCell("Refunded"), money(b.refundedCents)].join(","),
    [csvCell("Paid expenses and deposit fees"), money(b.expenseCents)].join(","), [csvCell("Net cash movement (not profit, not bank balance)"), money(b.netCashCents)].join(","),
    [csvCell("Voided entries are listed but excluded from totals")].join(","));
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `sediba-cashbook-${b.from}-to-${b.to}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminBookkeeping() {
  const today = jhbToday();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: monthStart(today), to: today });
  const [rangeErr, setRangeErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"ledger" | "deposits">("ledger");

  const q = useGetBookkeeping(range, {
    query: { queryKey: getGetBookkeepingQueryKey(range), staleTime: 15_000, refetchInterval: 60_000, refetchOnWindowFocus: true, placeholderData: previous => previous },
  });

  const apply = (f: string, t: string) => {
    if (!DATE_RE.test(f) || !DATE_RE.test(t)) return setRangeErr("Choose both a start and end date.");
    if (f > t) return setRangeErr("The start date must be on or before the end date.");
    if (daysBetween(f, t) + 1 > MAX_RANGE_DAYS) return setRangeErr(`Ranges are limited to ${MAX_RANGE_DAYS} days.`);
    setRangeErr(null); setFrom(f); setTo(t); setRange({ from: f, to: t });
  };
  const onApply = (e: FormEvent) => { e.preventDefault(); apply(from, to); };
  const d = q.data;

  return (
    <div className="space-y-6 animate-in fade-in">
      <header>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cash basis · Johannesburg dates</p>
        <h1 className="font-serif text-3xl mt-1">Bookkeeping</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">A running cashbook: receipts from sales and bookings arrive automatically, you add expenses already paid, and match bank deposits to the receipts they cover. Nothing is edited or deleted; mistakes are voided with a reason.</p>
      </header>

      <form onSubmit={onApply} noValidate className="bg-card border border-border p-4 sm:p-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end" aria-label="Cashbook date range">
        <div><label htmlFor="bk-from" className={labelCls}>From</label><input id="bk-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={inputCls} data-testid="input-books-from" /></div>
        <div><label htmlFor="bk-to" className={labelCls}>To (inclusive)</label><input id="bk-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} data-testid="input-books-to" /></div>
        <button type="submit" className={btnPrimary} data-testid="button-apply-books-range">Show</button>
        <div className="sm:col-span-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => apply(monthStart(today), today)} className={btnGhost} data-testid="button-preset-books-month">This month</button>
          <button type="button" onClick={() => { const [y, m] = today.split("-").map(Number); const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; const last = new Date(Date.UTC(Number(pm.slice(0, 4)), Number(pm.slice(5)), 0)).getUTCDate(); apply(`${pm}-01`, `${pm}-${last}`); }} className={btnGhost} data-testid="button-preset-books-last-month">Last month</button>
          <button type="button" onClick={() => apply(`${today.slice(0, 4)}-01-01`, today)} className={btnGhost} data-testid="button-preset-books-year">Year to date</button>
        </div>
        {rangeErr && <p className="sm:col-span-3 text-xs text-destructive" role="alert" data-testid="error-books-range">{rangeErr}</p>}
      </form>

      {q.isLoading ? (
        <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading cashbook">
          <div className="grid gap-px bg-border border border-border grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="bg-card h-28" />)}</div>
          <div className="grid gap-6 lg:grid-cols-2"><div className="h-96 bg-card border border-border" /><div className="h-96 bg-card border border-border" /></div>
        </div>
      ) : !d ? (
        <div className="bg-card border border-border p-8 text-center space-y-3" role="alert">
          <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
          <p className="text-sm">The cashbook could not be loaded.</p>
          <p className="text-xs text-muted-foreground">{errMsg(q.error)}</p>
          <button type="button" onClick={() => q.refetch()} className={btnGhost} data-testid="button-retry-books">Try again</button>
        </div>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground" aria-live="polite" data-testid="text-books-range">
            {formatJhb(`${d.from}T12:00:00+02:00`, false)} to {formatJhb(`${d.to}T12:00:00+02:00`, false)}{q.isFetching ? " · refreshing" : ""}
            {q.isError ? " · last refresh failed, showing earlier data" : ""}
          </p>
          <section className="grid gap-px bg-border border border-border grid-cols-2 lg:grid-cols-4" aria-label="Cash summary">
            <Stat label="Received" value={d.receivedCents} testId="text-books-received" />
            <Stat label="Refunded" value={-d.refundedCents} testId="text-books-refunded" />
            <Stat label="Paid out" value={-d.expenseCents} testId="text-books-expenses" hint="Expenses + deposit fees" />
            <Stat label="Net cash movement" value={d.netCashCents} testId="text-books-net" hint="Not profit. Not a bank balance." strong />
          </section>

          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <ExpenseForm />
            <DepositMatch unmatched={d.unmatchedReceipts} />
          </div>

          <section className="bg-card border border-border">
            <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-1" role="tablist">
                {(["ledger", "deposits"] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
                    className={`font-serif text-lg px-3 py-1 border-b-2 ${tab === t ? "border-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid={`tab-${t}`}>
                    {t === "ledger" ? `Ledger (${d.rows.length})` : `Deposits (${d.deposits.length})`}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => exportCsv(d)} disabled={d.rows.length === 0} className={btnGhost} data-testid="button-export-books-csv"><Download className="w-4 h-4" />Export CSV</button>
            </div>
            {tab === "ledger" ? (d.rows.length === 0
              ? <div className="p-10 text-center"><p className="font-serif text-lg">A quiet period.</p><p className="text-sm text-muted-foreground mt-1">No receipts, refunds or expenses in this range.</p></div>
              : <Ledger rows={d.rows} />) : <DepositsList deposits={d.deposits} />}
          </section>
        </>
      )}

      <aside className="border border-border bg-muted/30 p-4 sm:p-6 text-xs text-muted-foreground leading-relaxed flex gap-3" data-testid="text-books-disclaimer">
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-2">
          <p><span className="text-foreground font-medium">A cash record, not a full set of accounts.</span> Net cash movement is receipts minus refunds, paid expenses and deposit fees in the range. It is not profit and not your bank balance.</p>
          <p>Not included: unpaid bills, VAT accounting, stock and cost of goods, and any refund not yet recorded. Appointment refunds arrive here only when staff record them in the appointment Payments dialog after the money has actually been returned, including refunds already issued in the Yoco dashboard. Recording is manual; there is no automatic Yoco refund sync. Voiding corrects the record only; it never refunds or moves money. Give your accountant the CSV and bank statements for financial statements.</p>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, testId, hint, strong }: { label: string; value: number; testId: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`p-5 sm:p-6 ${strong ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-widest ${strong ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
      <p className="font-serif text-2xl sm:text-3xl mt-2 break-all" data-testid={testId}>{formatRand(value)}</p>
      {hint && <p className={`text-[11px] mt-2 ${strong ? "opacity-80" : "text-muted-foreground"}`}>{hint}</p>}
    </div>
  );
}
