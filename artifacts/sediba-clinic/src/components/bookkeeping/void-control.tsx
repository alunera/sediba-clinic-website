import { useState } from "react";
import { errMsg } from "@/lib/money";
import { btnGhost, inputCls } from "./shared";

/** Inline void with a required reason. Stays open while pending or after an error so a retry reuses the same intent. */
export function VoidControl({ label, explain, pending, onVoid, testId }: {
  label: string; explain: string; pending: boolean; testId: string;
  onVoid: (reason: string, done: () => void, fail: (e: unknown) => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!open) return <button type="button" className={btnGhost} onClick={() => setOpen(true)} data-testid={`button-open-${testId}`}>{label}</button>;

  const submit = () => {
    const r = reason.trim();
    if (!r) return setErr("A reason is required. It stays on the audit record.");
    if (r.length > 1000) return setErr("Keep the reason under 1000 characters.");
    setErr(null);
    onVoid(r, () => { setOpen(false); setReason(""); }, (e) => setErr(errMsg(e)));
  };

  return (
    <div className="mt-3 border border-destructive/30 bg-destructive/5 p-3 space-y-2 text-left w-full" data-testid={`panel-${testId}`}>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{explain}</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} rows={2} maxLength={1000}
        placeholder="Reason (required)" className={inputCls} data-testid={`input-reason-${testId}`} />
      {err && <p className="text-xs text-destructive" role="alert">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className={`${btnGhost} border-destructive text-destructive`} data-testid={`button-confirm-${testId}`}>
          {pending ? "Saving..." : "Confirm"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setErr(null); }} disabled={pending} className={btnGhost} data-testid={`button-cancel-${testId}`}>Cancel</button>
      </div>
    </div>
  );
}
