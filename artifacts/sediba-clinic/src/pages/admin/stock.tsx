import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowLeft, Info, Package, Plus, Search, X } from "lucide-react";
import {
  useListStock,
  getListStockQueryKey,
  useCreateStockProduct,
  useUpdateStockProduct,
  useListStockMovements,
  getListStockMovementsQueryKey,
  useRecordStockMovement,
  type StockProduct,
  type RecordStockMovementBodyKind,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { createIdempotencyKeeper, errMsg, formatJhb, formatRand, parseRandToCents } from "@/lib/money";

const inputCls = (bad?: string | false | null) =>
  `w-full bg-background border ${bad ? "border-destructive" : "border-border"} px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60`;
const labelCls = "text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5";
const btnGhost = "text-xs uppercase tracking-widest border border-border px-4 py-2.5 hover:bg-muted disabled:opacity-50";
const btnPrimary = "text-xs uppercase tracking-widest bg-primary text-primary-foreground px-5 py-3 hover:opacity-90 disabled:opacity-60";

const KIND_LABEL: Record<string, string> = { opening: "Opening", received: "Received", adjustment: "Adjustment", return: "Physical return", sale: "Sale" };
const isLow = (p: StockProduct) => p.onHand <= p.reorderLevel;
const status = (e: unknown) => (e as { status?: number } | null)?.status;

export const STOCK_QUERY_OPTS = { staleTime: 15_000, refetchOnWindowFocus: true, refetchOnMount: true } as const;

export default function AdminStock() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"active" | "low" | "archived" | "all">("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useListStock({ query: { queryKey: getListStockQueryKey(), ...STOCK_QUERY_OPTS } });
  const products = list.data ?? [];
  const lowCount = products.filter((p) => p.active && isLow(p)).length;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products
      .filter((p) => scope === "all" || (scope === "archived" ? !p.active : p.active && (scope === "active" || isLow(p))))
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, q, scope]);

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const showPanel = creating || selectedId !== null;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Inventory</p>
          <h1 className="font-serif text-3xl mt-1">Stock</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">Retail products counted in whole physical units. Every change is kept as permanent history.</p>
        </div>
        <button type="button" onClick={() => { setCreating(true); setSelectedId(null); }} className={`inline-flex items-center justify-center gap-2 ${btnPrimary}`} data-testid="button-new-product"><Plus className="w-4 h-4" /> New product</button>
      </div>

      <aside className="border-l-2 border-primary bg-primary/5 p-4 text-xs leading-relaxed flex gap-3 text-muted-foreground" data-testid="text-stock-notice">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
        <p>Stock is deducted when a sale with a stocked product is <b className="text-foreground">created</b>, not when it is paid. Refunds and voided sales do <b className="text-foreground">not</b> put stock back; record a physical return only when usable goods actually come back. Stock movements here never record an expense.</p>
      </aside>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className={`bg-card border border-border flex-col min-h-[420px] ${showPanel ? "hidden lg:flex" : "flex"}`} aria-label="Products">
          <div className="p-4 border-b border-border space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input type="search" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or SKU" maxLength={200} className={`${inputCls()} pl-9 pr-9`} data-testid="input-search-stock" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" data-testid="button-clear-stock-search"><X className="w-4 h-4" /></button>}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
              {([["active", "Active"], ["low", `Low stock${lowCount ? ` (${lowCount})` : ""}`], ["archived", "Archived"], ["all", "All"]] as const).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className={`text-[10px] uppercase tracking-widest px-2.5 py-1.5 border ${scope === v ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`} data-testid={`button-stock-filter-${v}`}>{l}</button>
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground" aria-live="polite" data-testid="text-stock-count">
              {list.isLoading ? "Loading..." : `${filtered.length} of ${products.length} products`}{list.isFetching && !list.isLoading ? " · refreshing" : ""}
            </p>
            {list.isError && list.data && <p className="text-xs border border-amber-500/40 bg-amber-500/10 p-2" role="status">Could not refresh; showing last loaded figures. <button type="button" className="underline" onClick={() => list.refetch()}>Retry</button></p>}
          </div>
          {list.isLoading ? (
            <ul className="divide-y divide-border animate-pulse" aria-hidden="true">{Array.from({ length: 6 }).map((_, i) => <li key={i} className="p-4 space-y-2"><div className="h-3 w-1/2 bg-muted" /><div className="h-3 w-1/3 bg-muted" /></li>)}</ul>
          ) : !list.data ? (
            <div className="p-8 text-center space-y-3" role="alert">
              <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
              <p className="text-sm">Stock could not be loaded.</p>
              <p className="text-xs text-muted-foreground">{errMsg(list.error)}</p>
              <button type="button" onClick={() => list.refetch()} className={btnGhost} data-testid="button-retry-stock">Try again</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3 my-auto">
              <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center text-muted-foreground"><Package className="w-5 h-5" /></div>
              {products.length === 0 ? (<>
                <p className="font-serif text-lg">No products yet.</p>
                <p className="text-sm text-muted-foreground">Add the retail products you sell to start counting stock.</p>
                <button type="button" onClick={() => setCreating(true)} className="text-xs uppercase tracking-widest underline underline-offset-4" data-testid="button-empty-new-product">Add a product</button>
              </>) : (<>
                <p className="font-serif text-lg">{scope === "low" ? "Nothing at or below its reorder level." : "No products match."}</p>
                <button type="button" onClick={() => { setQ(""); setScope("active"); }} className="text-xs uppercase tracking-widest underline underline-offset-4" data-testid="button-stock-reset">Reset filters</button>
              </>)}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-y-auto lg:max-h-[calc(100dvh-340px)]">
              {filtered.map((p) => {
                const active = p.id === selectedId;
                const low = p.active && isLow(p);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setSelectedId(p.id); setCreating(false); }} aria-current={active ? "true" : undefined}
                      className={`w-full text-left p-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-l-2 transition-colors ${active ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted/40"} ${!p.active ? "opacity-60" : ""}`} data-testid={`row-product-${p.id}`}>
                      <span className="font-medium truncate">{p.name}</span>
                      <span className={`font-mono text-sm text-right ${low ? "text-amber-800" : ""}`} data-testid={`text-onhand-${p.id}`}>{p.onHand} {p.unit}</span>
                      <span className="text-xs text-muted-foreground truncate"><span className="font-mono">{p.sku}</span> · {formatRand(p.unitPriceCents)} · reorder at {p.reorderLevel}</span>
                      <span className="text-right">
                        {!p.active ? <span className="text-[10px] uppercase tracking-widest px-2 py-1 bg-muted text-muted-foreground">Archived</span>
                          : low ? <span className="text-[10px] uppercase tracking-widest px-2 py-1 bg-amber-600/10 text-amber-800">Low</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={showPanel ? "block" : "hidden lg:block"} aria-label="Product details">
          {creating ? <ProductForm onDone={(id) => { setCreating(false); setSelectedId(id); }} onCancel={() => setCreating(false)} />
            : selectedId !== null ? (selected ? <ProductDetail key={selected.id} product={selected} onBack={() => setSelectedId(null)} />
              : <div className="bg-card border border-border p-8 text-center space-y-3"><p className="text-sm">This product is no longer in the list.</p><button type="button" onClick={() => setSelectedId(null)} className={btnGhost}>Back</button></div>)
            : (
              <div className="bg-card border border-dashed border-border min-h-[420px] flex flex-col items-center justify-center text-center p-10">
                <p className="font-serif text-xl">Select a product</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">Receive deliveries, record returns or adjustments, edit details and view history.</p>
              </div>
            )}
        </section>
      </div>
    </div>
  );
}

function Header({ eyebrow, title, onBack }: { eyebrow: string; title: string; onBack: () => void }) {
  return (
    <div className="p-6 border-b border-border flex items-start gap-3">
      <button type="button" onClick={onBack} className="lg:hidden p-1 -ml-1 mt-4 text-muted-foreground" aria-label="Back to products" data-testid="button-back-stock"><ArrowLeft className="w-5 h-5" /></button>
      <div className="min-w-0"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{eyebrow}</p><h2 className="font-serif text-2xl mt-1 break-words">{title}</h2></div>
    </div>
  );
}

/* ---------- Create / edit ---------- */

function ProductForm({ product, onDone, onCancel }: { product?: StockProduct; onDone: (id: number) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateStockProduct();
  const update = useUpdateStockProduct();
  const keeper = useRef(createIdempotencyKeeper());
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "bottle");
  const [price, setPrice] = useState(product ? (product.unitPriceCents / 100).toFixed(2) : "");
  const [reorder, setReorder] = useState(String(product?.reorderLevel ?? 0));
  const [opening, setOpening] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const pending = create.isPending || update.isPending;
  const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const er: Record<string, string> = {};
    if (!name.trim() || name.trim().length > 200) er.name = "Name is required (200 max).";
    if (!sku.trim() || sku.trim().length > 80) er.sku = "SKU is required (80 max).";
    if (!unit.trim() || unit.trim().length > 40) er.unit = "Unit is required, e.g. bottle.";
    const cents = parseRandToCents(price);
    if (cents === null || cents < 1 || cents > 100_000_000) er.price = "Enter Rands, e.g. 450 or 450.50.";
    const r = int(reorder);
    if (!Number.isInteger(r) || r > 1_000_000) er.reorder = "Whole number 0 or more.";
    const o = int(opening);
    if (!isEdit && (!Number.isInteger(o) || o > 1_000_000)) er.opening = "Whole units, 0 or more.";
    setErrors(er);
    if (Object.keys(er).length) return;
    const base = { name: name.trim(), sku: sku.trim(), unit: unit.trim(), unitPriceCents: cents as number, reorderLevel: r, active: product?.active ?? true };
    setSubmitError(null);
    const onError = (err: unknown) => {
      if (status(err) === 409 && isEdit) setStale(true);
      setSubmitError(errMsg(err));
      qc.invalidateQueries({ queryKey: getListStockQueryKey() });
    };
    if (product) {
      update.mutate({ id: product.id, data: { ...base, version: product.version } }, {
        onSuccess: (p) => { qc.invalidateQueries({ queryKey: getListStockQueryKey() }); toast({ title: "Product updated", description: p.name }); onDone(p.id); },
        onError,
      });
    } else {
      const body = { ...base, openingQuantity: o };
      const requestId = keeper.current.get(body);
      create.mutate({ data: { ...body, requestId } }, {
        onSuccess: (p) => { keeper.current.reset(); qc.invalidateQueries({ queryKey: getListStockQueryKey() }); toast({ title: "Product added", description: `${p.name}, ${p.onHand} ${p.unit} on hand.` }); onDone(p.id); },
        onError,
      });
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, opts: { err?: string; mode?: "numeric" | "decimal"; placeholder?: string; max?: number } = {}) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input id={id} value={value} onChange={(e) => set(e.target.value)} disabled={pending} inputMode={opts.mode} placeholder={opts.placeholder} maxLength={opts.max} aria-invalid={!!opts.err} className={inputCls(opts.err)} data-testid={`input-${id}`} />
      {opts.err && <p className="text-xs text-destructive mt-1">{opts.err}</p>}
    </div>
  );

  const inner = (
    <form onSubmit={submit} noValidate className="p-6 space-y-4">
      {field("product-name", "Name", name, setName, { err: errors.name, placeholder: "Hydrating serum 30ml", max: 200 })}
      <div className="grid sm:grid-cols-2 gap-4">
        {field("product-sku", "SKU", sku, setSku, { err: errors.sku, placeholder: "SER-HYD-30", max: 80 })}
        {field("product-unit", "Unit (one whole item)", unit, setUnit, { err: errors.unit, placeholder: "bottle", max: 40 })}
        {isEdit && <p className="text-xs text-muted-foreground">Keep the original unit once stock history exists. For a different pack size, create a separate product.</p>}
        {field("product-price", "Selling price (R)", price, setPrice, { err: errors.price, mode: "decimal", placeholder: "0.00" })}
        {field("product-reorder", "Reorder level", reorder, setReorder, { err: errors.reorder, mode: "numeric" })}
        {!isEdit && field("product-opening", "Opening quantity", opening, setOpening, { err: errors.opening, mode: "numeric" })}
      </div>
      {!isEdit ? <p className="text-xs text-muted-foreground">Opening quantity is recorded once as the first history entry. Later changes use receive, return or adjustment.</p>
        : <p className="text-xs text-muted-foreground">On-hand quantity is not edited here. Use a stock movement below.</p>}
      {stale && (
        <div className="text-sm border border-amber-500/40 bg-amber-500/10 p-3" role="alert" data-testid="text-product-stale">
          Someone else changed this product. The latest details have been reloaded; close and reopen edit to apply your change to the current version.
        </div>
      )}
      {submitError && !stale && <p className="text-sm text-destructive border border-destructive/40 p-3" role="alert" data-testid="error-product">{submitError}{!isEdit && " Submitting again is safe and will not create a duplicate."}</p>}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={pending} className={btnGhost} data-testid="button-cancel-product">{stale ? "Close" : "Cancel"}</button>
        <button type="submit" disabled={pending || stale} className={btnPrimary} data-testid="button-save-product">{pending ? "Saving..." : isEdit ? "Save changes" : "Add product"}</button>
      </div>
    </form>
  );
  if (isEdit) return <div className="border border-border">{inner}</div>;
  return <div className="bg-card border border-border"><Header eyebrow="New stock product" title="Add a product" onBack={onCancel} />{inner}</div>;
}

/* ---------- Detail ---------- */

function ProductDetail({ product, onBack }: { product: StockProduct; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<null | "edit" | RecordStockMovementBodyKind>(null);
  const update = useUpdateStockProduct();
  const movements = useListStockMovements(product.id, { query: { queryKey: getListStockMovementsQueryKey(product.id), ...STOCK_QUERY_OPTS } });
  const low = product.active && isLow(product);

  const toggleActive = () => {
    if (update.isPending) return;
    const { name, sku, unit, unitPriceCents, reorderLevel, active, version } = product;
    update.mutate({ id: product.id, data: { name, sku, unit, unitPriceCents, reorderLevel, active: !active, version } }, {
      onSuccess: (p) => { qc.invalidateQueries({ queryKey: getListStockQueryKey() }); toast({ title: p.active ? "Product reactivated" : "Product archived", description: p.name }); },
      onError: (err) => {
        qc.invalidateQueries({ queryKey: getListStockQueryKey() });
        toast({ variant: "destructive", title: status(err) === 409 ? "Product changed elsewhere" : "Could not update", description: status(err) === 409 ? "Latest details reloaded. Try again." : errMsg(err) });
      },
    });
  };

  const rows = [...(movements.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border">
        <Header eyebrow={`${product.sku}${product.active ? "" : " · archived"}`} title={product.name} onBack={onBack} />
        <div className="p-6 space-y-6">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border">
            <div className={`p-4 ${low ? "bg-amber-600/10" : "bg-card"}`}><dt className={labelCls}>On hand</dt><dd className="font-serif text-2xl" data-testid="text-product-onhand">{product.onHand} <span className="text-sm text-muted-foreground">{product.unit}</span></dd></div>
            <div className="p-4 bg-card"><dt className={labelCls}>Reorder at</dt><dd className="font-serif text-xl">{product.reorderLevel}</dd></div>
            <div className="p-4 bg-card"><dt className={labelCls}>Price</dt><dd className="font-serif text-xl">{formatRand(product.unitPriceCents)}</dd></div>
            <div className="p-4 bg-card"><dt className={labelCls}>Status</dt><dd className="text-sm mt-2">{product.active ? (low ? "Low stock" : "Active") : "Archived"}</dd></div>
          </dl>
          {low && <p className="text-xs flex gap-2 items-start text-amber-800"><AlertTriangle className="w-4 h-4 shrink-0" />At or below the reorder level. Time to restock.</p>}

          {mode === null && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setMode("received")} className={btnPrimary} data-testid="button-receive-stock">Receive</button>
              <button type="button" onClick={() => setMode("return")} className={btnGhost} data-testid="button-return-stock">Physical return</button>
              <button type="button" onClick={() => setMode("adjustment")} className={btnGhost} data-testid="button-adjust-stock">Adjust</button>
              <button type="button" onClick={() => setMode("edit")} className={btnGhost} data-testid="button-edit-product">Edit details</button>
              <button type="button" onClick={toggleActive} disabled={update.isPending} className={btnGhost} data-testid="button-toggle-archive">{update.isPending ? "Saving..." : product.active ? "Archive" : "Reactivate"}</button>
              <p className="w-full text-[11px] text-muted-foreground">Products are never deleted, so history stays intact. Archived products cannot be added to new sales.</p>
            </div>
          )}
          {mode === "edit" && <ProductForm key={product.version} product={product} onDone={() => setMode(null)} onCancel={() => setMode(null)} />}
          {mode && mode !== "edit" && <MovementForm key={mode} product={product} kind={mode} onDone={() => setMode(null)} />}
        </div>
      </div>

      <div className="bg-card border border-border">
        <div className="p-6 border-b border-border">
          <h3 className="font-serif text-xl">Movement history{movements.isFetching && !movements.isLoading ? <span className="text-xs text-muted-foreground font-sans"> · refreshing</span> : null}</h3>
          <p className="text-xs text-muted-foreground mt-1">Permanent record. Movements cannot be edited or deleted.</p>
        </div>
        {movements.isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="h-8 bg-muted" />)}</div>
        ) : !movements.data ? (
          <div className="p-8 text-center space-y-3" role="alert"><p className="text-sm">{errMsg(movements.error)}</p><button type="button" onClick={() => movements.refetch()} className={btnGhost} data-testid="button-retry-movements">Try again</button></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No movements recorded yet.</p>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((m) => (
              <li key={m.id} className="p-4 sm:px-6 grid grid-cols-[1fr_auto] gap-1" data-testid={`row-movement-${m.id}`}>
                <span className="text-sm"><span className="text-[10px] uppercase tracking-widest px-2 py-0.5 mr-2 bg-muted">{KIND_LABEL[m.kind] ?? m.kind}</span>
                  {m.saleId ? <Link href={`/admin/sales?sale=${m.saleId}`} className="text-xs underline underline-offset-4 text-primary" data-testid={`link-movement-sale-${m.id}`}>View sale</Link> : null}
                </span>
                <span className={`font-mono text-sm text-right ${m.quantity < 0 ? "text-destructive" : "text-emerald-800"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</span>
                <span className="text-xs text-muted-foreground break-words">{m.reason}</span>
                <span className="text-xs text-muted-foreground text-right whitespace-nowrap">{formatJhb(m.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function MovementForm({ product, kind, onDone }: { product: StockProduct; kind: RecordStockMovementBodyKind; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const record = useRecordStockMovement();
  const keeper = useRef(createIdempotencyKeeper());
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = record.isPending;
  const signed = kind === "adjustment";
  const title = kind === "received" ? "Receive stock" : kind === "return" ? "Physical return" : "Stock adjustment";
  const hint = kind === "received" ? "Units delivered and counted. Does not record a supplier expense; capture that in Bookkeeping."
    : kind === "return" ? "Only when usable goods are physically back on the shelf. A refund alone does not restore stock."
    : "Use a minus sign for losses, damage or count corrections, e.g. -2. A reason is required.";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListStockQueryKey() });
    qc.invalidateQueries({ queryKey: getListStockMovementsQueryKey(product.id) });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const t = qty.trim();
    const n = (signed ? /^-?\d+$/ : /^\d+$/).test(t) ? Number(t) : NaN;
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 1_000_000) return setError(signed ? "Enter a non-zero whole number, e.g. 3 or -2." : "Enter a positive whole number of units.");
    if (!reason.trim()) return setError(signed ? "A reason is required for adjustments." : "Add a note, e.g. supplier invoice or client name.");
    setError(null);
    const body = { kind, quantity: n, reason: reason.trim().slice(0, 1000) };
    const requestId = keeper.current.get({ id: product.id, ...body });
    record.mutate({ id: product.id, data: { ...body, requestId } }, {
      onSuccess: (p) => { keeper.current.reset(); refresh(); toast({ title: "Stock updated", description: `${p.name}: ${p.onHand} ${p.unit} on hand.` }); onDone(); },
      onError: (err) => { refresh(); setError(`${errMsg(err)} Submitting again is safe and will not double count.`); },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="border border-border p-4 space-y-4" aria-label={title}>
      <p className="font-serif text-lg">{title}</p>
      <div className="grid sm:grid-cols-[8rem_1fr] gap-3">
        <div>
          <label htmlFor="mv-qty" className={labelCls}>{signed ? "Change (+/-)" : `Units (${product.unit})`}</label>
          <input id="mv-qty" inputMode={signed ? "text" : "numeric"} value={qty} onChange={(e) => setQty(e.target.value)} disabled={pending} className={inputCls()} data-testid="input-movement-quantity" />
        </div>
        <div>
          <label htmlFor="mv-reason" className={labelCls}>Reason {signed && <span className="text-destructive">*</span>}</label>
          <input id="mv-reason" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} disabled={pending} placeholder={kind === "received" ? "Supplier invoice INV-2041" : kind === "return" ? "Unopened, returned by client" : "Damaged in storage"} className={inputCls()} data-testid="input-movement-reason" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p className="text-xs text-destructive" role="alert" data-testid="error-movement">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} disabled={pending} className={btnGhost} data-testid="button-cancel-movement">Cancel</button>
        <button type="submit" disabled={pending} className={btnPrimary} data-testid="button-submit-movement">{pending ? "Saving..." : "Record"}</button>
      </div>
    </form>
  );
}
