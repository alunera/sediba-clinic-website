import { useRef, useState, type FormEvent } from "react";
import { Undo2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRecordAppointmentRefund,
  getGetAppointmentReceiptsQueryKey,
  type AppointmentReceipts,
  type AppointmentRefundInputMethod,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createIdempotencyKeeper, errMsg, formatJhb, formatRand, methodLabel, parseRandToCents } from "@/lib/money";

export const REFUND_MUTATION_KEY = ["recordAppointmentRefund"];

const REFUND_METHOD_LABEL: Record<string, string> = {
  yoco: "Yoco (already issued in Yoco dashboard)",
  cash: "Cash (already handed back)",
  eft: "EFT (already sent)",
  card_external: "External card machine (already reversed)",
};

export function AppointmentRefundSection({ appointmentId, data, invalidateRelated }: { appointmentId: number; data: AppointmentReceipts; invalidateRelated: () => void }) {
  const qc = useQueryClient();
  const refund = useRecordAppointmentRefund({ mutation: { mutationKey: REFUND_MUTATION_KEY } });
  const keeper = useRef(createIdempotencyKeeper());
  const [paymentId, setPaymentId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<AppointmentRefundInputMethod | "">("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [returned, setReturned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const busy = refund.isPending;
  const refundable = data.receipts.filter((r) => r.refundableCents > 0);
  const original = data.receipts.find((r) => String(r.id) === paymentId);
  const isYoco = original?.method === "yoco";
  const methods: AppointmentRefundInputMethod[] = isYoco ? ["yoco", "cash", "eft", "card_external"] : ["cash", "eft", "card_external"];
  const receiptById = new Map(data.receipts.map((r) => [r.id, r]));

  const pickOriginal = (v: string) => {
    setPaymentId(v);
    const r = data.receipts.find((x) => String(x.id) === v);
    if (method === "yoco" && r?.method !== "yoco") setMethod("");
    if (r && r.method === "yoco" && !method) setMethod("yoco");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (busy) return;
    if (!original) return setError("Choose the original payment being refunded.");
    const cents = parseRandToCents(amount);
    if (cents === null || cents < 1) return setError("Enter a valid Rand amount, e.g. 250 or 250.50.");
    if (cents > original.refundableCents) return setError(`Amount cannot exceed ${formatRand(original.refundableCents)} still refundable on that payment.`);
    if (!method) return setError("Choose how the money was returned.");
    if (method === "yoco" && !isYoco) return setError("Yoco refunds can only be recorded against a Yoco payment.");
    if (!reference.trim()) return setError(method === "yoco" ? "Add the Yoco refund transaction reference." : "Add a reference, e.g. EFT reference or staff initials.");
    if (!reason.trim()) return setError("Add a reason for the refund.");
    if (!returned) return setError("Confirm the money has already been returned to the client.");
    setError(null);
    const payload = { paymentId: original.id, amountCents: cents, method, reference: reference.trim(), reason: reason.trim(), returned: true };
    const requestId = keeper.current.get({ appointmentId, ...payload });
    refund.mutate({ id: appointmentId, data: { requestId, ...payload } }, {
      onSuccess: (next) => {
        keeper.current.reset();
        setPaymentId(""); setAmount(""); setMethod(""); setReference(""); setReason(""); setReturned(false);
        setNotice(`Refund of ${formatRand(cents)} recorded.`);
        setOpen(false);
        qc.setQueryData(getGetAppointmentReceiptsQueryKey(appointmentId), next);
        invalidateRelated();
      },
      onError: (err) => {
        setError(errMsg(err));
        qc.invalidateQueries({ queryKey: getGetAppointmentReceiptsQueryKey(appointmentId) });
      },
    });
  };

  const label = "text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5";
  const input = "w-full bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60";

  return (
    <section aria-label="Refunds" className="space-y-3 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">Refunds</h3>
        {refundable.length > 0 && !open && (
          <button type="button" onClick={() => { setOpen(true); setNotice(null); }} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:bg-muted" data-testid="button-open-refund">
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />Record a refund
          </button>
        )}
      </div>

      {data.refunds.length === 0 ? (
        <p className="text-xs text-muted-foreground">No refunds recorded.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {data.refunds.map((f) => {
            const orig = receiptById.get(f.paymentId);
            return (
              <li key={f.id} className="p-3 flex justify-between gap-3 text-sm" data-testid={`row-refund-${f.id}`}>
                <div className="min-w-0">
                  <p>Refund · {methodLabel(f.method)} <span className="text-muted-foreground text-xs">· {formatJhb(f.createdAt)}</span></p>
                  <p className="text-xs text-muted-foreground break-words">Ref {f.reference} · {f.reason}</p>
                  {orig && <p className="text-[11px] text-muted-foreground">Against {methodLabel(orig.method)} payment of {formatRand(orig.amountCents)}</p>}
                </div>
                <span className="font-mono whitespace-nowrap text-destructive">-{formatRand(f.amountCents)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {notice && <p className="text-xs text-green-700" role="status" data-testid="text-refund-success">{notice}</p>}

      {open && (
        <form onSubmit={submit} noValidate className="space-y-4 border border-border bg-muted/30 p-4" aria-label="Record refund">
          <p className="text-xs leading-relaxed">
            Record a refund <span className="font-medium">after</span> the money has actually gone back to the client. This button moves no money and does not contact Yoco. It does not cancel or reschedule the booking, and the outstanding balance is unchanged.
          </p>
          <div>
            <label id="rf-orig-label" className={label}>Original payment</label>
            <Select value={paymentId} onValueChange={pickOriginal} disabled={busy}>
              <SelectTrigger aria-labelledby="rf-orig-label" className="rounded-none border-border h-[42px]" data-testid="select-refund-original"><SelectValue placeholder="Choose payment" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {refundable.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {methodLabel(r.method)} {formatRand(r.amountCents)} · {formatJhb(r.createdAt, false)} · {formatRand(r.refundableCents)} refundable
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rf-amount" className={label}>Amount returned (R)</label>
              <input id="rf-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} placeholder={original ? (original.refundableCents / 100).toFixed(2) : "0.00"} className={input} data-testid="input-refund-amount" />
              {original && <button type="button" disabled={busy} onClick={() => setAmount((original.refundableCents / 100).toFixed(2))} className="text-[10px] uppercase tracking-widest text-primary mt-1.5 hover:underline" data-testid="button-refund-fill">Full remaining</button>}
            </div>
            <div>
              <label id="rf-method-label" className={label}>How it was returned</label>
              <Select value={method} onValueChange={(v) => setMethod(v as AppointmentRefundInputMethod)} disabled={busy || !original}>
                <SelectTrigger aria-labelledby="rf-method-label" className="rounded-none border-border h-[42px]" data-testid="select-refund-method"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {methods.map((m) => <SelectItem key={m} value={m}>{REFUND_METHOD_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor="rf-ref" className={label}>{method === "yoco" ? "Yoco refund transaction reference" : "Refund reference"}</label>
            <input id="rf-ref" value={reference} maxLength={200} onChange={(e) => setReference(e.target.value)} disabled={busy} placeholder={method === "yoco" ? "From the Yoco dashboard refund" : "EFT reference, slip number, staff initials"} className={input} data-testid="input-refund-reference" />
          </div>
          <div>
            <label htmlFor="rf-reason" className={label}>Reason</label>
            <textarea id="rf-reason" value={reason} maxLength={1000} rows={2} onChange={(e) => setReason(e.target.value)} disabled={busy} placeholder="Why the money was returned" className={input} data-testid="input-refund-reason" />
          </div>
          <label className="flex gap-3 items-start text-sm cursor-pointer">
            <input type="checkbox" checked={returned} onChange={(e) => setReturned(e.target.checked)} disabled={busy} className="mt-1 accent-[hsl(var(--primary))]" data-testid="checkbox-refund-returned" />
            <span>Money already returned. I confirm this refund has already been paid back to the client{method === "yoco" ? " in the Yoco dashboard" : ""}. Nothing is sent by this system.</span>
          </label>
          {error && <p className="text-xs text-destructive" role="alert" data-testid="error-refund">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 text-xs uppercase tracking-widest bg-foreground text-background px-5 py-3 hover:opacity-90 disabled:opacity-60" data-testid="button-record-refund">
              {busy ? "Recording..." : "Record refund"}
            </button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null); }} className="text-xs uppercase tracking-widest border border-border px-4 py-3 hover:bg-muted disabled:opacity-60" data-testid="button-cancel-refund">Close</button>
          </div>
        </form>
      )}
    </section>
  );
}
