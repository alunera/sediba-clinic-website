import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Ban, Info, Plus, Printer, Search, Trash2, X } from "lucide-react";
import {
  useListAdminSales,
  getListAdminSalesQueryKey,
  useCreateAdminSale,
  useAddAdminSaleEntry,
  useVoidAdminSale,
  useListAdminClientRecords,
  getListAdminClientRecordsQueryKey,
  getGetAdminFinancialReportQueryKey,
  type ClinicSale,
  type ClinicSaleItemKind,
  type ClinicSaleEntryInputMethod,
  type ClinicSaleEntryInputKind,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { createIdempotencyKeeper, errMsg, escapeHtml, formatJhb, formatRand, methodLabel, parseRandToCents, printDocument } from "@/lib/money";

const STATUS: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: "bg-amber-600/10 text-amber-800" },
  part_paid: { label: "Part paid", tone: "bg-amber-600/10 text-amber-800" },
  paid: { label: "Paid", tone: "bg-emerald-700/10 text-emerald-800" },
  partially_refunded: { label: "Part refunded", tone: "bg-primary/10 text-primary" },
  refunded: { label: "Refunded", tone: "bg-muted text-muted-foreground" },
  void: { label: "Void", tone: "bg-muted text-muted-foreground line-through" },
};

const inputCls = (bad?: string | false | null) =>
  `w-full bg-background border ${bad ? "border-destructive" : "border-border"} px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60`;
const labelCls = "text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5";
const btnGhost = "text-xs uppercase tracking-widest border border-border px-4 py-2.5 hover:bg-muted disabled:opacity-50";
const btnPrimary = "text-xs uppercase tracking-widest bg-primary text-primary-foreground px-5 py-3 hover:opacity-90 disabled:opacity-60";

function useInvalidateMoney() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: getListAdminSalesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetAdminFinancialReportQueryKey() });
  };
}

function StatusBadge({ status, id }: { status: string; id: number | string }) {
  const s = STATUS[status] ?? { label: status, tone: "bg-muted" };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 whitespace-nowrap ${s.tone}`} data-testid={`status-sale-${id}`}>{s.label}</span>;
}

export default function AdminSales() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useListAdminSales({ query: { queryKey: getListAdminSalesQueryKey(), staleTime: 15_000, refetchOnWindowFocus: true } });
  const sales = list.data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales
      .filter((s) => statusFilter === "all" || (statusFilter === "owing" ? s.outstandingCents > 0 && s.status !== "void" : s.status === statusFilter))
      .filter((s) => !q || s.reference.toLowerCase().includes(q) || s.clientName.toLowerCase().includes(q) || s.items.some((i) => i.description.toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [sales, query, statusFilter]);

  const selected = sales.find((s) => s.id === selectedId) ?? null;
  const showPanel = creating || selectedId !== null;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sales register</p>
          <h1 className="font-serif text-3xl mt-1">Sales</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">Walk-in treatments, retail products and anything else not paid through an online booking.</p>
        </div>
        <button type="button" onClick={() => { setCreating(true); setSelectedId(null); }} className={`inline-flex items-center justify-center gap-2 ${btnPrimary}`} data-testid="button-new-sale">
          <Plus className="w-4 h-4" /> New sale
        </button>
      </div>

      <aside className="border-l-2 border-primary bg-primary/5 p-4 text-sm leading-relaxed flex gap-3" data-testid="text-booking-notice">
        <Info className="w-4 h-4 shrink-0 mt-1 text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">Do not re-enter online bookings here.</p>
          <p className="text-muted-foreground text-xs mt-1">Yoco payments for bookings are included in Reports automatically. Use this register only for extra or non-booking sales. Recording a sale does not deduct stock.</p>
        </div>
      </aside>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className={`bg-card border border-border flex-col min-h-[420px] ${showPanel ? "hidden lg:flex" : "flex"}`} aria-label="Sales list">
          <div className="p-4 border-b border-border space-y-3">
            <label htmlFor="sale-search" className="sr-only">Search sales</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="sale-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference, client or item" maxLength={200} className={`${inputCls()} pl-9 pr-9`} data-testid="input-search-sales" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" data-testid="button-clear-sale-search"><X className="w-4 h-4" /></button>}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {[["all", "All"], ["owing", "Owing"], ["paid", "Paid"], ["partially_refunded", "Part refunded"], ["refunded", "Refunded"], ["void", "Void"]].map(([v, l]) => (
                <button key={v} type="button" aria-pressed={statusFilter === v} onClick={() => setStatusFilter(v)} className={`text-[10px] uppercase tracking-widest px-2.5 py-1.5 border ${statusFilter === v ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`} data-testid={`button-filter-${v}`}>{l}</button>
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground" aria-live="polite" data-testid="text-sale-count">
              {list.isLoading ? "Loading…" : `${filtered.length} of ${sales.length} sales`}{list.isFetching && !list.isLoading ? " · refreshing" : ""}
            </p>
          </div>
          {list.isLoading ? (
            <ul className="divide-y divide-border animate-pulse" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => <li key={i} className="p-4 space-y-2"><div className="h-3 w-1/2 bg-muted" /><div className="h-3 w-1/3 bg-muted" /></li>)}
            </ul>
          ) : list.isError ? (
            <div className="p-8 text-center space-y-3" role="alert">
              <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
              <p className="text-sm">Sales could not be loaded.</p>
              <p className="text-xs text-muted-foreground">{errMsg(list.error)}</p>
              <button type="button" onClick={() => list.refetch()} className={btnGhost} data-testid="button-retry-sales">Try again</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3 my-auto">
              <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center font-serif text-lg text-muted-foreground">R</div>
              {sales.length === 0 ? (
                <>
                  <p className="font-serif text-lg">No manual sales yet.</p>
                  <p className="text-sm text-muted-foreground">Record a product or walk-in treatment sold outside online booking.</p>
                  <button type="button" onClick={() => setCreating(true)} className="text-xs uppercase tracking-widest underline underline-offset-4" data-testid="button-empty-new-sale">Record a sale</button>
                </>
              ) : (
                <>
                  <p className="font-serif text-lg">No sales match.</p>
                  <button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }} className="text-xs uppercase tracking-widest underline underline-offset-4" data-testid="button-empty-reset">Reset filters</button>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-y-auto lg:max-h-[calc(100dvh-340px)]">
              {filtered.map((s) => {
                const active = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => { setSelectedId(s.id); setCreating(false); }} aria-current={active ? "true" : undefined}
                      className={`w-full text-left p-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 transition-colors border-l-2 ${active ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted/40"}`} data-testid={`row-sale-${s.id}`}>
                      <span className="font-medium truncate">{s.clientName}</span>
                      <span className={`font-mono text-sm text-right ${s.status === "void" ? "line-through text-muted-foreground" : ""}`}>{formatRand(s.totalCents)}</span>
                      <span className="text-xs text-muted-foreground truncate"><span className="font-mono">{s.reference}</span> · {formatJhb(s.createdAt, false)} · {s.items.map((i) => i.description).join(", ")}</span>
                      <span className="text-right"><StatusBadge status={s.status} id={s.id} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={showPanel ? "block" : "hidden lg:block"} aria-label="Sale details">
          {creating ? (
            <CreateSale onCancel={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelectedId(id); }} />
          ) : selectedId !== null ? (
            selected ? <SaleDetail key={selected.id} sale={selected} onBack={() => setSelectedId(null)} />
              : list.isLoading ? <div className="bg-card border border-border h-96 animate-pulse" aria-busy="true" />
              : <div className="bg-card border border-border p-8 text-center space-y-3" role="alert"><p className="text-sm">This sale is no longer in the list.</p><button type="button" onClick={() => setSelectedId(null)} className={btnGhost} data-testid="button-missing-back">Back</button></div>
          ) : (
            <div className="bg-card border border-dashed border-border min-h-[420px] flex flex-col items-center justify-center text-center p-10">
              <p className="font-serif text-xl">Select a sale</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">Open a sale to record payments, refunds, view its history or print a receipt.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PanelHeader({ eyebrow, title, onBack, action }: { eyebrow: string; title: string; onBack: () => void; action?: React.ReactNode }) {
  return (
    <div className="p-6 border-b border-border flex items-start gap-3">
      <button type="button" onClick={onBack} className="lg:hidden p-1 -ml-1 mt-4 text-muted-foreground hover:text-foreground" aria-label="Back to sales list" data-testid="button-back-sales"><ArrowLeft className="w-5 h-5" /></button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h2 className="font-serif text-2xl mt-1 break-words" data-testid="text-sale-panel-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------------- Create ---------------- */

type Line = { key: number; description: string; kind: ClinicSaleItemKind; quantity: string; price: string };
let lineSeq = 1;
const blankLine = (): Line => ({ key: lineSeq++, description: "", kind: "treatment", quantity: "1", price: "" });

function ClientPicker({ value, onChange, error, disabled }: { value: { id: number; name: string } | null; onChange: (c: { id: number; name: string } | null) => void; error?: string; disabled: boolean }) {
  const [term, setTerm] = useState("");
  const params = term.trim() ? { search: term.trim().slice(0, 200) } : undefined;
  const clients = useListAdminClientRecords(params, { query: { queryKey: getListAdminClientRecordsQueryKey(params), staleTime: 30_000 } });
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 border border-primary bg-primary/5 px-3 py-2.5">
        <span className="text-sm font-medium" data-testid="text-selected-client">{value.name}</span>
        <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground" data-testid="button-change-client">Change</button>
      </div>
    );
  }
  const rows = (clients.data ?? []).slice(0, 8);
  return (
    <div>
      <input id="sale-client" type="search" value={term} onChange={(e) => setTerm(e.target.value)} disabled={disabled} placeholder="Search client by name, phone or email" maxLength={200} aria-invalid={!!error} aria-describedby={error ? "sale-client-err" : undefined} className={inputCls(error)} data-testid="input-client-search" />
      <div className="border border-t-0 border-border max-h-56 overflow-y-auto" aria-live="polite">
        {clients.isLoading ? <p className="p-3 text-xs text-muted-foreground">Loading clients…</p>
          : clients.isError ? <p className="p-3 text-xs text-destructive">Clients could not be loaded. <button type="button" className="underline" onClick={() => clients.refetch()} data-testid="button-retry-client-search">Retry</button></p>
          : rows.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No matching clients. Create the client record on the Clients page first.</p>
          : <ul className="divide-y divide-border">{rows.map((c) => (
              <li key={c.id}><button type="button" onClick={() => onChange({ id: c.id, name: c.name })} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" data-testid={`option-client-${c.id}`}>
                <span className="font-medium">{c.name}</span> <span className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
              </button></li>))}</ul>}
      </div>
      {error && <p id="sale-client-err" className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function CreateSale({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: number) => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidateMoney();
  const create = useCreateAdminSale();
  const keeper = useRef(createIdempotencyKeeper());
  const [client, setClient] = useState<{ id: number; name: string } | null>(null);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pending = create.isPending;

  const parsed = lines.map((l) => ({ q: /^\d+$/.test(l.quantity.trim()) ? Number(l.quantity) : NaN, c: parseRandToCents(l.price) }));
  const total = parsed.reduce((t, p) => (Number.isFinite(p.q) && p.c ? t + p.q * p.c : t), 0);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!client) er.client = "Choose an existing client.";
    lines.forEach((l, i) => {
      if (!l.description.trim()) er[`d${l.key}`] = "Description is required.";
      else if (l.description.trim().length > 200) er[`d${l.key}`] = "200 characters maximum.";
      const q = parsed[i].q;
      if (!Number.isInteger(q) || q < 1 || q > 1000) er[`q${l.key}`] = "Whole number 1 to 1000.";
      const c = parsed[i].c;
      if (c === null) er[`p${l.key}`] = "Enter Rands, e.g. 450 or 450.50 (max 2 decimals).";
      else if (c < 1 || c > 100_000_000) er[`p${l.key}`] = "Between R 0.01 and R 1 000 000.";
    });
    if (notes.length > 2000) er.notes = "2000 characters maximum.";
    setErrors(er);
    if (Object.keys(er).length || !client) return;
    const body = {
      clientId: client.id,
      notes: notes.trim() || undefined,
      items: lines.map((l, i) => ({ description: l.description.trim(), kind: l.kind, quantity: parsed[i].q, unitPriceCents: parsed[i].c as number })),
    };
    const requestId = keeper.current.get(body);
    setSubmitError(null);
    create.mutate({ data: { ...body, requestId } }, {
      onSuccess: (sale) => {
        keeper.current.reset();
        invalidate();
        toast({ title: "Sale recorded", description: `${sale.reference} for ${sale.clientName}, ${formatRand(sale.totalCents)}. Unpaid until a payment is recorded.` });
        onCreated(sale.id);
      },
      onError: (err) => { invalidate(); setSubmitError(errMsg(err)); },
    });
  };

  return (
    <div className="bg-card border border-border">
      <PanelHeader eyebrow="New manual sale" title="Record a sale" onBack={onCancel} />
      <form onSubmit={submit} noValidate className="p-6 space-y-6">
        <div>
          <label htmlFor="sale-client" className={labelCls}>Client <span className="text-destructive" aria-hidden="true">*</span></label>
          <ClientPicker value={client} onChange={setClient} error={errors.client} disabled={pending} />
        </div>

        <fieldset className="space-y-3">
          <legend className={labelCls}>Items <span className="text-destructive" aria-hidden="true">*</span></legend>
          {lines.map((l, i) => (
            <div key={l.key} className="border border-border p-3 space-y-3" data-testid={`line-${i}`}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor={`d-${l.key}`} className="sr-only">Description, line {i + 1}</label>
                  <input id={`d-${l.key}`} value={l.description} maxLength={200} disabled={pending} onChange={(e) => update(l.key, { description: e.target.value })} placeholder="e.g. Hydrating serum 30ml" aria-invalid={!!errors[`d${l.key}`]} className={inputCls(errors[`d${l.key}`])} data-testid={`input-line-description-${i}`} />
                  {errors[`d${l.key}`] && <p className="text-xs text-destructive mt-1">{errors[`d${l.key}`]}</p>}
                </div>
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} disabled={pending || lines.length === 1} aria-label={`Remove line ${i + 1}`} className="p-2.5 border border-border hover:bg-muted disabled:opacity-30 self-start" data-testid={`button-remove-line-${i}`}><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-[1fr_5rem_1fr] gap-2">
                <div>
                  <label htmlFor={`k-${l.key}`} className="text-[9px] uppercase tracking-widest text-muted-foreground">Type</label>
                  <select id={`k-${l.key}`} value={l.kind} disabled={pending} onChange={(e) => update(l.key, { kind: e.target.value as ClinicSaleItemKind })} className={inputCls()} data-testid={`select-line-kind-${i}`}>
                    <option value="treatment">Treatment</option><option value="product">Product</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`q-${l.key}`} className="text-[9px] uppercase tracking-widest text-muted-foreground">Qty</label>
                  <input id={`q-${l.key}`} inputMode="numeric" value={l.quantity} disabled={pending} onChange={(e) => update(l.key, { quantity: e.target.value })} aria-invalid={!!errors[`q${l.key}`]} className={inputCls(errors[`q${l.key}`])} data-testid={`input-line-quantity-${i}`} />
                </div>
                <div>
                  <label htmlFor={`p-${l.key}`} className="text-[9px] uppercase tracking-widest text-muted-foreground">Unit price (R)</label>
                  <input id={`p-${l.key}`} inputMode="decimal" value={l.price} disabled={pending} onChange={(e) => update(l.key, { price: e.target.value })} placeholder="0.00" aria-invalid={!!errors[`p${l.key}`]} className={inputCls(errors[`p${l.key}`])} data-testid={`input-line-price-${i}`} />
                </div>
              </div>
              {(errors[`q${l.key}`] || errors[`p${l.key}`]) && <p className="text-xs text-destructive">{[errors[`q${l.key}`], errors[`p${l.key}`]].filter(Boolean).join(" ")}</p>}
            </div>
          ))}
          <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} disabled={pending || lines.length >= 50} className={`inline-flex items-center gap-2 ${btnGhost}`} data-testid="button-add-line"><Plus className="w-4 h-4" />Add line</button>
        </fieldset>

        <div>
          <label htmlFor="sale-notes" className={labelCls}>Notes <span className="normal-case tracking-normal">(optional)</span></label>
          <textarea id="sale-notes" rows={3} value={notes} maxLength={2000} disabled={pending} onChange={(e) => setNotes(e.target.value)} className={inputCls(errors.notes)} data-testid="input-sale-notes" />
          {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes}</p>}
        </div>

        <div className="flex items-baseline justify-between border-t border-border pt-4">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Sale total</span>
          <span className="font-serif text-3xl" data-testid="text-new-sale-total">{formatRand(total)}</span>
        </div>
        <p className="text-xs text-muted-foreground">The sale starts as unpaid. Record money received afterwards. No stock is deducted.</p>
        {submitError && <p className="text-sm text-destructive border border-destructive/40 p-3" role="alert" data-testid="error-create-sale">{submitError} Submitting again is safe and will not create a duplicate.</p>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending} className={btnGhost} data-testid="button-cancel-sale">Cancel</button>
          <button type="submit" disabled={pending} aria-busy={pending} className={btnPrimary} data-testid="button-submit-sale">{pending ? "Recording…" : submitError ? "Retry" : "Record sale"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Detail ---------------- */

function SaleDetail({ sale, onBack }: { sale: ClinicSale; onBack: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<null | ClinicSaleEntryInputKind | "void">(null);
  const isVoid = sale.status === "void";
  const refundable = sale.paidCents - sale.refundedCents;
  const canVoid = !isVoid && sale.entries.length === 0 && sale.paidCents === 0;
  const entries = [...sale.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const print = () => {
    const items = sale.items.map((i) => `<tr><td>${escapeHtml(i.description)}</td><td>${i.kind}</td><td class="r">${i.quantity}</td><td class="r">${formatRand(i.unitPriceCents)}</td><td class="r">${formatRand(i.quantity * i.unitPriceCents)}</td></tr>`).join("");
    const hist = entries.map((e) => `<tr><td>${escapeHtml(formatJhb(e.createdAt))}</td><td>${e.kind}</td><td>${escapeHtml(methodLabel(e.method))}</td><td>${escapeHtml(e.reason)}</td><td class="r">${e.kind === "refund" ? "-" : ""}${formatRand(e.amountCents)}</td></tr>`).join("");
    const ok = printDocument(`Sediba ${sale.reference}`, `<h1>SEDIBA</h1><p class="eyebrow">Aesthetic &amp; Wellness Clinic</p>
<p class="eyebrow" style="margin-top:20px">${isVoid ? "Void sale record" : "Payment record"} · ${escapeHtml(sale.reference)}</p>
<p>Client: <b>${escapeHtml(sale.clientName)}</b><br>Date: ${escapeHtml(formatJhb(sale.createdAt))}${isVoid ? `<br>Voided: ${escapeHtml(sale.voidReason)}` : ""}</p>
<table><thead><tr><th>Item</th><th>Type</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Line</th></tr></thead><tbody>${items}</tbody></table>
<table class="tot"><tr><td>Total</td><td class="r">${formatRand(sale.totalCents)}</td></tr><tr><td>Paid</td><td class="r">${formatRand(sale.paidCents)}</td></tr><tr><td>Refunded</td><td class="r">${formatRand(sale.refundedCents)}</td></tr><tr><td><b>Outstanding</b></td><td class="r"><b>${formatRand(sale.outstandingCents)}</b></td></tr></table>
${hist ? `<table><thead><tr><th>When</th><th>Type</th><th>Method</th><th>Note</th><th class="r">Amount</th></tr></thead><tbody>${hist}</tbody></table>` : ""}
${sale.notes ? `<p>Notes: ${escapeHtml(sale.notes)}</p>` : ""}
<div class="note">This is a record of the transaction only. It is not a tax invoice.</div>`);
    if (!ok) toast({ variant: "destructive", title: "Print window blocked", description: "Allow pop-ups for this site to print." });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border">
        <PanelHeader eyebrow={`${sale.reference} · ${formatJhb(sale.createdAt)}`} title={sale.clientName} onBack={onBack}
          action={<button type="button" onClick={print} className={`inline-flex items-center gap-2 ${btnGhost}`} data-testid="button-print-receipt"><Printer className="w-4 h-4" /><span className="hidden sm:inline">Print record</span></button>} />
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3"><StatusBadge status={sale.status} id="detail" />{isVoid && <span className="text-xs text-muted-foreground" data-testid="text-void-reason">Voided: {sale.voidReason}</span>}</div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border">
            {[["Total", sale.totalCents, "total"], ["Paid", sale.paidCents, "paid"], ["Refunded", sale.refundedCents, "refunded"], ["Outstanding", sale.outstandingCents, "outstanding"]].map(([l, v, k]) => (
              <div key={k as string} className={`p-4 ${k === "outstanding" && (v as number) > 0 && !isVoid ? "bg-amber-600/10" : "bg-card"}`}>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</dt>
                <dd className="font-serif text-xl mt-1" data-testid={`text-sale-${k}`}>{formatRand(v as number)}</dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border"><th className="py-2 font-normal">Item</th><th className="py-2 font-normal text-right">Qty</th><th className="py-2 font-normal text-right">Unit</th><th className="py-2 font-normal text-right">Line</th></tr></thead>
              <tbody className="divide-y divide-border">
                {sale.items.map((i, idx) => (
                  <tr key={idx} data-testid={`row-sale-item-${idx}`}>
                    <td className="py-2.5">{i.description} <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-1">{i.kind}</span></td>
                    <td className="py-2.5 text-right">{i.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{formatRand(i.unitPriceCents)}</td>
                    <td className="py-2.5 text-right font-mono">{formatRand(i.quantity * i.unitPriceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sale.notes && <p className="text-sm whitespace-pre-wrap bg-muted/30 border-l-2 border-primary/50 p-4" data-testid="text-sale-notes">{sale.notes}</p>}

          {!isVoid && mode === null && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setMode("payment")} disabled={sale.outstandingCents <= 0} className={btnPrimary} data-testid="button-record-payment">Record payment</button>
              <button type="button" onClick={() => setMode("refund")} disabled={refundable <= 0} className={btnGhost} data-testid="button-record-refund">Record refund</button>
              <button type="button" onClick={() => setMode("void")} disabled={!canVoid} className={`inline-flex items-center gap-2 ${btnGhost}`} data-testid="button-void-sale"><Ban className="w-4 h-4" />Void</button>
              {!canVoid && <p className="w-full text-[11px] text-muted-foreground">Sales with recorded payments cannot be voided. Record a refund instead.</p>}
              {sale.outstandingCents <= 0 && <p className="w-full text-[11px] text-muted-foreground">Fully paid. Nothing outstanding.</p>}
            </div>
          )}
          {mode === "payment" || mode === "refund" ? (
            <EntryForm key={mode} sale={sale} kind={mode} max={mode === "payment" ? sale.outstandingCents : refundable} onDone={() => setMode(null)} />
          ) : mode === "void" ? (
            <VoidForm sale={sale} onDone={() => setMode(null)} />
          ) : null}
        </div>
      </div>

      <div className="bg-card border border-border">
        <div className="p-6 border-b border-border">
          <h3 className="font-serif text-xl">Transaction history</h3>
          <p className="text-xs text-muted-foreground mt-1">Permanent record. Entries cannot be edited or deleted.</p>
        </div>
        {entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No money recorded against this sale yet.</p>
        ) : (
          <ol className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="p-4 sm:px-6 grid grid-cols-[1fr_auto] gap-1" data-testid={`row-entry-${e.id}`}>
                <span className="text-sm"><span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 mr-2 ${e.kind === "refund" ? "bg-destructive/10 text-destructive" : "bg-emerald-700/10 text-emerald-800"}`}>{e.kind}</span>{methodLabel(e.method)}</span>
                <span className={`font-mono text-sm text-right ${e.kind === "refund" ? "text-destructive" : ""}`}>{e.kind === "refund" ? "-" : ""}{formatRand(e.amountCents)}</span>
                <span className="text-xs text-muted-foreground break-words">{e.reason}</span>
                <span className="text-xs text-muted-foreground text-right whitespace-nowrap">{formatJhb(e.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function EntryForm({ sale, kind, max, onDone }: { sale: ClinicSale; kind: ClinicSaleEntryInputKind; max: number; onDone: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidateMoney();
  const add = useAddAdminSaleEntry();
  const keeper = useRef(createIdempotencyKeeper());
  const [amount, setAmount] = useState((max / 100).toFixed(2));
  const [method, setMethod] = useState<ClinicSaleEntryInputMethod>("card_external");
  const [reason, setReason] = useState(kind === "payment" ? "Payment received" : "");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pending = add.isPending;
  const isRefund = kind === "refund";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const cents = parseRandToCents(amount);
    if (cents === null) er.amount = "Enter Rands with at most 2 decimals.";
    else if (cents < 1) er.amount = "Amount must be more than zero.";
    else if (cents > max) er.amount = `Cannot exceed ${formatRand(max)}.`;
    if (!reason.trim()) er.reason = isRefund ? "A refund reason is required." : "Add a short note.";
    else if (reason.trim().length > 1000) er.reason = "1000 characters maximum.";
    if (!confirmed) er.confirm = "Tick the confirmation to continue.";
    setErrors(er);
    if (Object.keys(er).length || cents === null) return;
    const body = { kind, amountCents: cents, method, reason: reason.trim() };
    const requestId = keeper.current.get(body);
    setSubmitError(null);
    add.mutate({ id: sale.id, data: { ...body, requestId } }, {
      onSuccess: () => {
        keeper.current.reset();
        invalidate();
        toast({ title: isRefund ? "Refund recorded" : "Payment recorded", description: `${formatRand(cents)} ${methodLabel(method)} on ${sale.reference}.` });
        onDone();
      },
      onError: (err) => { invalidate(); setSubmitError(errMsg(err)); },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="border border-border p-4 sm:p-5 space-y-4 bg-muted/20" aria-label={isRefund ? "Record refund" : "Record payment"}>
      <div>
        <h4 className="font-serif text-lg">{isRefund ? "Record a refund already issued" : "Record money received"}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {isRefund
            ? `Up to ${formatRand(max)} (paid minus already refunded). This logs money you have already returned to the client. It does not cancel the sale or reopen the balance owed.`
            : `Outstanding ${formatRand(max)}. Partial payments are allowed.`}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="entry-amount" className={labelCls}>Amount (R)</label>
          <input id="entry-amount" inputMode="decimal" value={amount} disabled={pending} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? "entry-amount-err" : undefined} className={inputCls(errors.amount)} data-testid="input-entry-amount" />
          {errors.amount && <p id="entry-amount-err" className="text-xs text-destructive mt-1">{errors.amount}</p>}
        </div>
        <div>
          <label htmlFor="entry-method" className={labelCls}>Method</label>
          <select id="entry-method" value={method} disabled={pending} onChange={(e) => setMethod(e.target.value as ClinicSaleEntryInputMethod)} className={inputCls()} data-testid="select-entry-method">
            <option value="card_external">Card (external machine)</option><option value="cash">Cash</option><option value="eft">EFT</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="entry-reason" className={labelCls}>{isRefund ? "Refund reason" : "Note"} <span className="text-destructive" aria-hidden="true">*</span></label>
        <input id="entry-reason" value={reason} maxLength={1000} disabled={pending} onChange={(e) => setReason(e.target.value)} aria-invalid={!!errors.reason} className={inputCls(errors.reason)} data-testid="input-entry-reason" />
        {errors.reason && <p className="text-xs text-destructive mt-1">{errors.reason}</p>}
      </div>
      <label className={`flex gap-3 items-start border p-3 text-xs leading-relaxed cursor-pointer ${errors.confirm ? "border-destructive" : "border-amber-700/40 bg-amber-600/5"}`}>
        <input type="checkbox" checked={confirmed} disabled={pending} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[hsl(var(--primary))]" data-testid="checkbox-confirm-entry" />
        <span><span className="font-medium uppercase tracking-wider">This records money {isRefund ? "refunded" : "received"} externally.</span> It does not {isRefund ? "refund" : "charge"} a card or move any money. I confirm this {isRefund ? "refund has already been issued" : "payment has already been received"}.</span>
      </label>
      {errors.confirm && <p className="text-xs text-destructive -mt-2">{errors.confirm}</p>}
      {submitError && <p className="text-sm text-destructive border border-destructive/40 p-3" role="alert" data-testid="error-entry">{submitError} Retrying the same entry will not double-record it.</p>}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={onDone} disabled={pending} className={btnGhost} data-testid="button-cancel-entry">Cancel</button>
        <button type="submit" disabled={pending || !confirmed} aria-busy={pending} className={btnPrimary} data-testid="button-submit-entry">{pending ? "Saving…" : submitError ? "Retry" : isRefund ? "Record refund" : "Record payment"}</button>
      </div>
    </form>
  );
}

function VoidForm({ sale, onDone }: { sale: ClinicSale; onDone: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidateMoney();
  const voidSale = useVoidAdminSale();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pending = voidSale.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError("A reason is required.");
    if (reason.trim().length > 1000) return setError("1000 characters maximum.");
    setError(null); setSubmitError(null);
    voidSale.mutate({ id: sale.id, data: { reason: reason.trim() } }, {
      onSuccess: () => { invalidate(); toast({ title: "Sale voided", description: `${sale.reference} is kept on record as void.` }); onDone(); },
      onError: (err) => { invalidate(); setSubmitError(errMsg(err)); },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="border border-destructive/40 p-4 sm:p-5 space-y-4" aria-label="Void sale">
      <div>
        <h4 className="font-serif text-lg">Void this sale</h4>
        <p className="text-xs text-muted-foreground mt-1">For sales entered in error with no money recorded. The sale stays in the register marked void and cannot be reopened.</p>
      </div>
      <div>
        <label htmlFor="void-reason" className={labelCls}>Reason <span className="text-destructive" aria-hidden="true">*</span></label>
        <input id="void-reason" value={reason} maxLength={1000} disabled={pending} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} className={inputCls(error)} data-testid="input-void-reason" />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      {submitError && <p className="text-sm text-destructive border border-destructive/40 p-3" role="alert" data-testid="error-void">{submitError}</p>}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={onDone} disabled={pending} className={btnGhost} data-testid="button-cancel-void">Keep sale</button>
        <button type="submit" disabled={pending} aria-busy={pending} className="text-xs uppercase tracking-widest bg-destructive text-destructive-foreground px-5 py-3 hover:opacity-90 disabled:opacity-60" data-testid="button-confirm-void">{pending ? "Voiding…" : submitError ? "Retry void" : "Void sale"}</button>
      </div>
    </form>
  );
}
