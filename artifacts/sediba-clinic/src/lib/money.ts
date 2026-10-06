export const JHB_TZ = "Africa/Johannesburg";

export function formatRand(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100).toLocaleString("en-ZA").replace(/\u00a0/g, " ");
  const c = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}R ${rands}.${c}`;
}

/** Strictly parse a Rand string to integer cents. Returns null when invalid. */
export function parseRandToCents(input: string): number | null {
  const s = input.trim().replace(/^R\s*/i, "").replace(/[\s,]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function jhbToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JHB_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function formatJhb(iso: string, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: JHB_TZ, day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(d);
}

export const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  eft: "EFT",
  card_external: "Card (external machine)",
  yoco: "Yoco (online booking)",
};
export const methodLabel = (m: string) => METHOD_LABEL[m] ?? m.replace(/_/g, " ");

export function errMsg(err: unknown): string {
  const e = err as { data?: { error?: string; message?: string }; message?: string } | null;
  return e?.data?.error ?? e?.data?.message ?? e?.message ?? "Something went wrong. Please try again.";
}

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Returns a requestId that stays stable while the payload fingerprint is unchanged. */
export function createIdempotencyKeeper() {
  let fp: string | null = null;
  let id = "";
  return {
    get(payload: unknown) {
      const next = JSON.stringify(payload);
      if (next !== fp) { fp = next; id = newRequestId(); }
      return id;
    },
    reset() { fp = null; id = ""; },
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function printDocument(title: string, bodyHtml: string): boolean {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:Georgia,serif;color:#2a2622;max-width:640px;margin:32px auto;padding:0 20px;font-size:13px}
h1{font-weight:normal;letter-spacing:.2em;margin:0;font-size:22px}
.eyebrow{font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:9px;color:#7a7168}
table{width:100%;border-collapse:collapse;margin:16px 0;font-family:system-ui,sans-serif;font-size:12px}
th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #ddd5cb}th{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#7a7168}
.r{text-align:right}.note{border:1px solid #c9bfb3;padding:10px;font-family:system-ui,sans-serif;font-size:11px;margin-top:20px}
.tot td{border:none;padding:3px 4px}
</style></head><body>${bodyHtml}<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

/** Neutralise spreadsheet formula injection and quote a CSV cell. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
