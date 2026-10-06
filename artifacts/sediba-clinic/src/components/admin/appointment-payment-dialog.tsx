import { useRef, useState, type FormEvent } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import {
  useGetAppointmentReceipts,
  getGetAppointmentReceiptsQueryKey,
  useRecordAppointmentReceipt,
  type AdminAppointment,
  type AppointmentReceiptInputMethod,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createIdempotencyKeeper, errMsg, formatJhb, formatRand, methodLabel, parseRandToCents } from "@/lib/money";

const RELATED_PREFIXES = ["/api/admin/appointments", "/api/admin/financial-report", "/api/admin/client", "/api/admin/availability", "/api/appointments", "/api/payments"];

function isRelated(q: Query) {
  const k = q.queryKey[0];
  return typeof k === "string" && RELATED_PREFIXES.some((p) => k.startsWith(p));
}

export function AppointmentPaymentDialog({ appointment, open, onOpenChange }: { appointment: AdminAppointment; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const id = appointment.id;
  const detail = useGetAppointmentReceipts(id, {
    query: { queryKey: getGetAppointmentReceiptsQueryKey(id), enabled: open, refetchOnWindowFocus: true, refetchInterval: open ? 15_000 : false },
  });
  const record = useRecordAppointmentReceipt();
  const keeper = useRef(createIdempotencyKeeper());

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<AppointmentReceiptInputMethod | "">("");
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const d = detail.data;
  const blocked = d?.blockedReason?.trim() ?? "";
  const outstanding = d?.outstandingCents ?? 0;
  const canRecord = !!d && !blocked && outstanding > 0;
  const submitting = record.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!canRecord) return;
    const cents = parseRandToCents(amount);
    if (cents === null || cents < 1) return setError("Enter a valid Rand amount, e.g. 250 or 250.50.");
    if (cents > outstanding) return setError(`Amount cannot exceed the outstanding balance of ${formatRand(outstanding)}.`);
    if (!method) return setError("Choose how the money was received.");
    if (!reference.trim()) return setError("Add a reference or note, e.g. slip number or who took the payment.");
    if (!received) return setError("Confirm the money has already been received.");
    setError(null);
    const payload = { amountCents: cents, method, reference: reference.trim(), received: true };
    const requestId = keeper.current.get({ id, ...payload });
    record.mutate({ id, data: { requestId, ...payload } }, {
      onSuccess: () => {
        keeper.current.reset();
        setAmount(""); setMethod(""); setReference(""); setReceived(false);
        setNotice(`${formatRand(cents)} recorded.`);
        qc.invalidateQueries({ predicate: isRelated });
        qc.invalidateQueries({ queryKey: getGetAppointmentReceiptsQueryKey(id) });
      },
      onError: (err) => {
        setError(errMsg(err));
        qc.invalidateQueries({ queryKey: getGetAppointmentReceiptsQueryKey(id) });
      },
    });
  };

  const label = "text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5";
  const input = "w-full bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="rounded-none border-border max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">In-salon payment · <span className="font-mono">{appointment.bookingRef}</span></p>
          <DialogTitle className="font-serif text-2xl font-normal">{appointment.clientName}</DialogTitle>
          <DialogDescription>{appointment.serviceName}. Record money already received at the clinic. No card is charged here.</DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="space-y-3 animate-pulse" aria-busy="true"><div className="h-20 bg-muted" /><div className="h-32 bg-muted" /></div>
        ) : detail.isError || !d ? (
          <div className="border border-border p-6 text-center space-y-3" role="alert">
            <AlertCircle className="w-5 h-5 mx-auto text-destructive" />
            <p className="text-sm">{errMsg(detail.error)}</p>
            <button type="button" onClick={() => detail.refetch()} className="text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted" data-testid="button-retry-receipts">Try again</button>
          </div>
        ) : (
          <div className="space-y-6">
            <dl className="grid grid-cols-3 gap-px bg-border border border-border text-center">
              {[["Total", d.totalCents, "total"], ["Paid", d.paidCents, "paid"], ["Outstanding", d.outstandingCents, "outstanding"]].map(([l, v, t]) => (
                <div key={t as string} className={`p-3 ${t === "outstanding" && d.outstandingCents > 0 ? "bg-amber-500/10" : "bg-card"}`}>
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</dt>
                  <dd className="font-serif text-lg mt-1" data-testid={`text-receipt-${t}`}>{formatRand(v as number)}</dd>
                </div>
              ))}
            </dl>

            <section aria-label="Payment history">
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">History{detail.isFetching ? " · refreshing" : ""}</h3>
              {d.receipts.length === 0 ? (
                <p className="text-sm text-muted-foreground border border-dashed border-border p-4">No in-salon receipts recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border border border-border">
                  {d.receipts.map((r) => (
                    <li key={r.id} className="p-3 flex justify-between gap-3 text-sm" data-testid={`row-receipt-${r.id}`}>
                      <div className="min-w-0">
                        <p>{methodLabel(r.method)} <span className="text-muted-foreground text-xs">· {formatJhb(r.createdAt)}</span></p>
                        <p className="text-xs text-muted-foreground break-words">{r.reference}</p>
                      </div>
                      <span className="font-mono whitespace-nowrap">{formatRand(r.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {blocked ? (
              <div className="flex gap-3 border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status" data-testid="text-receipt-blocked">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
                <p>{blocked}</p>
              </div>
            ) : outstanding <= 0 ? (
              <p className="text-sm border border-border bg-muted/40 p-4" data-testid="text-receipt-settled">This booking is fully paid.</p>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4 border-t border-border pt-5" aria-label="Record payment">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rcpt-amount" className={label}>Amount (R)</label>
                    <input id="rcpt-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={submitting} placeholder={(outstanding / 100).toFixed(2)} className={input} data-testid="input-receipt-amount" />
                    <button type="button" disabled={submitting} onClick={() => setAmount((outstanding / 100).toFixed(2))} className="text-[10px] uppercase tracking-widest text-primary mt-1.5 hover:underline" data-testid="button-receipt-fill-balance">Full balance</button>
                  </div>
                  <div>
                    <label id="rcpt-method-label" className={label}>Method</label>
                    <Select value={method} onValueChange={(v) => setMethod(v as AppointmentReceiptInputMethod)} disabled={submitting}>
                      <SelectTrigger aria-labelledby="rcpt-method-label" className="rounded-none border-border h-[42px]" data-testid="select-receipt-method"><SelectValue placeholder="Choose" /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="eft">EFT</SelectItem>
                        <SelectItem value="card_external">Card (external machine)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label htmlFor="rcpt-ref" className={label}>Reference / note</label>
                  <input id="rcpt-ref" value={reference} maxLength={1000} onChange={(e) => setReference(e.target.value)} disabled={submitting} placeholder="Slip number, EFT reference, staff initials" className={input} data-testid="input-receipt-reference" />
                </div>
                <label className="flex gap-3 items-start text-sm cursor-pointer">
                  <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} disabled={submitting} className="mt-1 accent-[hsl(var(--primary))]" data-testid="checkbox-receipt-received" />
                  <span>I confirm this money has already been received. No card will be charged by this system.</span>
                </label>
                <p className="text-xs text-muted-foreground">A partial payment keeps the booking pending. Paying the full balance confirms it (completed and no-show bookings keep their status). Receipts cannot be edited afterwards.</p>
                {error && <p className="text-xs text-destructive" role="alert" data-testid="error-receipt">{error}</p>}
                {notice && <p className="text-xs text-green-700" role="status" data-testid="text-receipt-success">{notice}</p>}
                <button type="submit" disabled={submitting} className="w-full text-xs uppercase tracking-widest bg-primary text-primary-foreground px-5 py-3 hover:opacity-90 disabled:opacity-60" data-testid="button-record-receipt">
                  {submitting ? "Recording..." : "Record payment"}
                </button>
              </form>
            )}
            {notice && (blocked || outstanding <= 0) && <p className="text-xs text-green-700" role="status">{notice}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
