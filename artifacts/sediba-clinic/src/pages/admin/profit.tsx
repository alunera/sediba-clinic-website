import { useState, type FormEvent } from "react";
import { AlertCircle, Download, Info } from "lucide-react";
import { useGetProfitReport, getGetProfitReportQueryKey } from "@workspace/api-client-react";
import { errMsg, formatJhb, jhbToday } from "@/lib/money";
import { daysBetween } from "@/components/bookkeeping/shared";
import { CashStatement } from "@/components/profit/cash-statement";
import { ProductMargins, RefundWarning } from "@/components/profit/product-margins";
import { downloadProfitCsv } from "@/components/profit/shared";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 367;
const monthStart = (t: string) => `${t.slice(0, 8)}01`;
const inputCls = "w-full bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
const chip = "text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:bg-muted";

export default function AdminProfit() {
  const today = jhbToday();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: monthStart(today), to: today });
  const [error, setError] = useState<string | null>(null);

  const report = useGetProfitReport(range, {
    query: { queryKey: getGetProfitReportQueryKey(range), staleTime: 30_000, refetchOnWindowFocus: true, placeholderData: (prev) => prev },
  });

  const validate = (f: string, t: string) => {
    if (!DATE_RE.test(f) || !DATE_RE.test(t)) return "Choose both a start and end date.";
    if (f > t) return "The start date must be on or before the end date.";
    if (daysBetween(f, t) + 1 > MAX_DAYS) return `Choose ${MAX_DAYS} days or fewer.`;
    return null;
  };
  const show = (f: string, t: string) => { const e = validate(f, t); setError(e); if (!e) setRange({ from: f, to: t }); };
  const apply = (e: FormEvent) => { e.preventDefault(); show(from, to); };
  const preset = (f: string, t: string) => { setFrom(f); setTo(t); show(f, t); };
  const d = report.data;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cash basis</p>
        <h1 className="font-serif text-3xl mt-1">Profit &amp; products</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">Cash profit for a Johannesburg date range, and separately, gross margin on retail products sold.</p>
      </div>

      <form onSubmit={apply} noValidate className="bg-card border border-border p-4 sm:p-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end" aria-label="Profit report date range">
        <div>
          <label htmlFor="p-from" className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">From</label>
          <input id="p-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={inputCls} data-testid="input-profit-from" />
        </div>
        <div>
          <label htmlFor="p-to" className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">To (inclusive)</label>
          <input id="p-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} data-testid="input-profit-to" />
        </div>
        <button type="submit" className="text-xs uppercase tracking-widest bg-primary text-primary-foreground px-5 py-3 hover:opacity-90" data-testid="button-apply-profit-range">Show report</button>
        <div className="sm:col-span-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => preset(monthStart(today), today)} className={chip} data-testid="button-profit-preset-month">This month</button>
          <button type="button" onClick={() => preset(`${today.slice(0, 4)}-01-01`, today)} className={chip} data-testid="button-profit-preset-year">Year to date</button>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground self-center">Up to {MAX_DAYS} days</span>
        </div>
        {error && <p className="sm:col-span-3 text-xs text-destructive" role="alert" data-testid="error-profit-range">{error}</p>}
      </form>

      {report.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] animate-pulse" aria-busy="true" aria-label="Loading report">
          <div className="h-96 bg-card border border-border" /><div className="h-96 bg-card border border-border" />
        </div>
      ) : !d ? (
        <div className="bg-card border border-border p-8 text-center space-y-3" role="alert">
          <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
          <p className="text-sm">The profit report could not be loaded.</p>
          <p className="text-xs text-muted-foreground">{errMsg(report.error)}</p>
          <button type="button" onClick={() => report.refetch()} className="text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted" data-testid="button-retry-profit">Try again</button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground" aria-live="polite" data-testid="text-profit-range">
              {formatJhb(`${d.from}T12:00:00+02:00`, false)} to {formatJhb(`${d.to}T12:00:00+02:00`, false)}{report.isFetching ? " · refreshing" : ""}
            </p>
            <button type="button" onClick={() => downloadProfitCsv(d)} className="inline-flex items-center gap-2 text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted self-start" data-testid="button-export-profit-csv"><Download className="w-4 h-4" />Export CSV</button>
          </div>
          {report.isError && <p className="text-xs border border-amber-500/40 bg-amber-500/10 p-2" role="status">Could not refresh; showing last loaded figures. <button type="button" className="underline" onClick={() => report.refetch()} data-testid="button-retry-profit-refresh">Retry</button></p>}
          <div className="grid grid-cols-1 min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
            <CashStatement r={d} />
            <div className="space-y-4">
              <RefundWarning count={d.refundedSaleCount} />
              <ProductMargins r={d} />
            </div>
          </div>
        </>
      )}

      <aside className="border border-border bg-muted/30 p-4 sm:p-6 text-xs text-muted-foreground leading-relaxed flex gap-3" data-testid="text-profit-disclaimer">
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-2">
          <p><span className="text-foreground font-medium">Two different views, never added together.</span> Cash profit counts money when it moves. Product gross margin counts product lines when the sale is created, before refunds, including unpaid sales.</p>
          <p>Product costs are per-unit snapshots taken when each sale was created; editing a product's cost affects future sales only. This is not FIFO costing, stock valuation, VAT or tax. Use your accountant's books for financial statements.</p>
        </div>
      </aside>
    </div>
  );
}
