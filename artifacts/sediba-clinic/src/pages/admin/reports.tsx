import { useState, type FormEvent } from "react";
import { AlertCircle, Download, Info, Printer } from "lucide-react";
import { useGetAdminFinancialReport, getGetAdminFinancialReportQueryKey, type ClinicFinancialReport } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { csvCell, errMsg, escapeHtml, formatJhb, formatRand, jhbToday, methodLabel, printDocument } from "@/lib/money";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthStart(today: string) { return `${today.slice(0, 8)}01`; }

const SOURCE_LABEL: Record<string, string> = { manual_sale: "Manual sale", booking_payment: "Booking (Yoco)" };

export default function AdminReports() {
  const today = jhbToday();
  const { toast } = useToast();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: monthStart(today), to: today });
  const [error, setError] = useState<string | null>(null);

  const report = useGetAdminFinancialReport(range, {
    query: { queryKey: getGetAdminFinancialReportQueryKey(range), staleTime: 30_000, refetchOnWindowFocus: true },
  });

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return setError("Choose both a start and end date.");
    if (from > to) return setError("The start date must be on or before the end date.");
    setError(null);
    setRange({ from, to });
  };

  const preset = (f: string, t: string) => { setFrom(f); setTo(t); setError(null); setRange({ from: f, to: t }); };
  const d = report.data;

  const exportCsv = (r: ClinicFinancialReport) => {
    const head = ["Date (Johannesburg)", "Reference", "Client", "Source", "Type", "Method", "Amount (ZAR)"];
    const lines = [head.map(csvCell).join(",")];
    for (const row of r.rows) {
      const amt = ((row.kind === "refund" ? -1 : 1) * row.amountCents / 100).toFixed(2);
      lines.push([formatJhb(row.createdAt), row.reference, row.clientName, SOURCE_LABEL[row.source] ?? row.source, row.kind, methodLabel(row.method)].map(csvCell).concat(`"${amt}"`).join(","));
    }
    lines.push("", [csvCell("Received"), `"${(r.receivedCents / 100).toFixed(2)}"`].join(","), [csvCell("Refunded"), `"${(r.refundedCents / 100).toFixed(2)}"`].join(","), [csvCell("Net receipts (not profit)"), `"${(r.netReceiptsCents / 100).toFixed(2)}"`].join(","));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sediba-receipts-${r.from}-to-${r.to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const printReport = (r: ClinicFinancialReport) => {
    const rows = r.rows.map((x) => `<tr><td>${escapeHtml(formatJhb(x.createdAt))}</td><td>${escapeHtml(x.reference)}</td><td>${escapeHtml(x.clientName)}</td><td>${escapeHtml(SOURCE_LABEL[x.source] ?? x.source)}</td><td>${x.kind}</td><td>${escapeHtml(methodLabel(x.method))}</td><td class="r">${x.kind === "refund" ? "-" : ""}${formatRand(x.amountCents)}</td></tr>`).join("");
    const ok = printDocument(`Sediba receipts ${r.from} to ${r.to}`, `<h1>SEDIBA</h1><p class="eyebrow">Receipts summary · ${r.from} to ${r.to} (Johannesburg)</p>
<table class="tot"><tr><td>Received</td><td class="r">${formatRand(r.receivedCents)}</td></tr><tr><td>Refunded</td><td class="r">${formatRand(r.refundedCents)}</td></tr><tr><td><b>Net receipts</b></td><td class="r"><b>${formatRand(r.netReceiptsCents)}</b></td></tr><tr><td>Manual sales created</td><td class="r">${formatRand(r.manualSalesCents)}</td></tr><tr><td>Manual unpaid (all dates)</td><td class="r">${formatRand(r.outstandingCents)}</td></tr></table>
<table><thead><tr><th>Date</th><th>Ref</th><th>Client</th><th>Source</th><th>Type</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No transactions.</td></tr>'}</tbody></table>
<div class="note">Net receipts are money in minus money refunded. Not profit. Excludes expenses, tax, provider fees and settlements, and refunds issued directly in the Yoco dashboard that are not reflected in booking records. Not a full set of accounts.</div>`);
    if (!ok) toast({ variant: "destructive", title: "Print window blocked", description: "Allow pop-ups for this site to print." });
  };

  const inputCls = "w-full bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Money in, money out</p>
        <h1 className="font-serif text-3xl mt-1">Reports</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">Receipts recorded against online bookings (Yoco) and the manual sales register, for an inclusive Johannesburg date range.</p>
      </div>

      <form onSubmit={apply} noValidate className="bg-card border border-border p-4 sm:p-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end" aria-label="Report date range">
        <div>
          <label htmlFor="r-from" className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">From</label>
          <input id="r-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={inputCls} data-testid="input-report-from" />
        </div>
        <div>
          <label htmlFor="r-to" className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">To (inclusive)</label>
          <input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} data-testid="input-report-to" />
        </div>
        <button type="submit" className="text-xs uppercase tracking-widest bg-primary text-primary-foreground px-5 py-3 hover:opacity-90" data-testid="button-apply-range">Show report</button>
        <div className="sm:col-span-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => preset(today, today)} className="text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:bg-muted" data-testid="button-preset-today">Today</button>
          <button type="button" onClick={() => preset(monthStart(today), today)} className="text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:bg-muted" data-testid="button-preset-month">This month</button>
          <button type="button" onClick={() => preset(`${today.slice(0, 4)}-01-01`, today)} className="text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:bg-muted" data-testid="button-preset-year">Year to date</button>
        </div>
        {error && <p className="sm:col-span-3 text-xs text-destructive" role="alert" data-testid="error-range">{error}</p>}
      </form>

      {report.isLoading ? (
        <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading report">
          <div className="grid gap-px bg-border border border-border sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="bg-card h-28" />)}</div>
          <div className="h-64 bg-card border border-border" />
        </div>
      ) : report.isError || !d ? (
        <div className="bg-card border border-border p-8 text-center space-y-3" role="alert">
          <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
          <p className="text-sm">The report could not be loaded.</p>
          <p className="text-xs text-muted-foreground">{errMsg(report.error)}</p>
          <button type="button" onClick={() => report.refetch()} className="text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted" data-testid="button-retry-report">Try again</button>
        </div>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground" aria-live="polite" data-testid="text-report-range">
            {formatJhb(`${d.from}T12:00:00+02:00`, false)} to {formatJhb(`${d.to}T12:00:00+02:00`, false)}{report.isFetching ? " · refreshing" : ""}
          </p>
          <section className="grid gap-px bg-border border border-border sm:grid-cols-3" aria-label="Receipts">
            <Stat label="Received" value={d.receivedCents} testId="text-received" />
            <Stat label="Refunded" value={d.refundedCents} testId="text-refunded" negative />
            <Stat label="Net receipts" value={d.netReceiptsCents} testId="text-net" hint="Received minus refunded. Not profit." strong />
          </section>
          <section className="grid gap-px bg-border border border-border sm:grid-cols-2" aria-label="Manual register">
            <Stat label="Manual sales created in range" value={d.manualSalesCents} testId="text-manual-sales" hint="Value of register sales opened in this range, paid or not. Voided sales excluded." />
            <Stat label="Manual sales unpaid (all dates)" value={d.outstandingCents} testId="text-outstanding" hint="Current balance owed across every manual sale, regardless of the range above." />
          </section>

          <div className="bg-card border border-border">
            <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl">Transactions</h2>
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-row-count">{d.rows.length} {d.rows.length === 1 ? "entry" : "entries"}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => printReport(d)} className="inline-flex items-center gap-2 text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted" data-testid="button-print-report"><Printer className="w-4 h-4" />Print</button>
                <button type="button" onClick={() => exportCsv(d)} disabled={d.rows.length === 0} className="inline-flex items-center gap-2 text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted disabled:opacity-50" data-testid="button-export-csv"><Download className="w-4 h-4" />Export CSV</button>
              </div>
            </div>
            {d.rows.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-serif text-lg">Nothing received or refunded in this range.</p>
                <p className="text-sm text-muted-foreground mt-1">Try a wider date range.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="p-3 sm:px-6 font-normal">Date</th><th className="p-3 font-normal">Reference</th><th className="p-3 font-normal">Client</th><th className="p-3 font-normal">Source</th><th className="p-3 font-normal">Method</th><th className="p-3 sm:px-6 font-normal text-right">Amount</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {d.rows.map((r, i) => (
                      <tr key={`${r.reference}-${r.createdAt}-${i}`} data-testid={`row-transaction-${i}`}>
                        <td className="p-3 sm:px-6 whitespace-nowrap text-muted-foreground">{formatJhb(r.createdAt)}</td>
                        <td className="p-3 font-mono text-xs">{r.reference}</td>
                        <td className="p-3">{r.clientName}</td>
                        <td className="p-3"><span className={`text-[10px] uppercase tracking-widest px-2 py-1 ${r.source === "booking_payment" ? "bg-primary/10 text-primary" : "bg-muted"}`}>{SOURCE_LABEL[r.source] ?? r.source}</span></td>
                        <td className="p-3 text-muted-foreground">{methodLabel(r.method)}</td>
                        <td className={`p-3 sm:px-6 text-right font-mono whitespace-nowrap ${r.kind === "refund" ? "text-destructive" : ""}`}>{r.kind === "refund" ? "Refund -" : ""}{formatRand(r.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <aside className="border border-border bg-muted/30 p-4 sm:p-6 text-xs text-muted-foreground leading-relaxed flex gap-3" data-testid="text-report-disclaimer">
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-2">
          <p><span className="text-foreground font-medium">This is a receipts report, not accounting.</span> Net receipts are money received minus money refunded. They are not profit.</p>
          <p>Excludes expenses, VAT and other tax, payment provider fees and settlement timing, and any refund issued directly in the Yoco dashboard that is not reflected in the booking payment records. Use your accountant's books for financial statements.</p>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, testId, hint, negative, strong }: { label: string; value: number; testId: string; hint?: string; negative?: boolean; strong?: boolean }) {
  return (
    <div className={`p-5 sm:p-6 ${strong ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-widest ${strong ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
      <p className="font-serif text-3xl mt-2" data-testid={testId}>{negative && value > 0 ? "-" : ""}{formatRand(value)}</p>
      {hint && <p className={`text-[11px] mt-2 leading-relaxed ${strong ? "opacity-80" : "text-muted-foreground"}`}>{hint}</p>}
    </div>
  );
}
