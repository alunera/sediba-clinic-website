import { useEffect, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, X, Mail, Phone, MessageCircle, Cake, ArrowLeft, AlertCircle, Info } from "lucide-react";
import {
  useListAdminClientRecords,
  getListAdminClientRecordsQueryKey,
  useCreateAdminClientRecord,
  useGetAdminClientRecord,
  getGetAdminClientRecordQueryKey,
  useUpdateAdminClientRecord,
  type AdminClientRecord,
  type AdminClientRecordDetail,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const STALE_MS = 30_000;
const REFETCH_MS = 60_000;

type FormState = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  dateOfBirth: string;
  internalNotes: string;
};

const emptyForm: FormState = { name: "", email: "", phone: "", whatsapp: "", dateOfBirth: "", internalNotes: "" };

function toForm(r: AdminClientRecord): FormState {
  return {
    name: r.name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    whatsapp: r.whatsapp ?? "",
    dateOfBirth: r.dateOfBirth ?? "",
    internalNotes: r.internalNotes ?? "",
  };
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function validate(f: FormState): Partial<Record<keyof FormState | "contact", string>> {
  const e: Partial<Record<keyof FormState | "contact", string>> = {};
  if (!f.name.trim()) e.name = "Name is required.";
  else if (f.name.trim().length > 200) e.name = "Name must be 200 characters or fewer.";
  if (!f.email.trim() && !f.phone.trim() && !f.whatsapp.trim())
    e.contact = "Add at least one contact channel: email, phone or WhatsApp.";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (f.email.trim().length > 254) e.email = "Email is too long.";
  if (f.phone.trim().length > 40) e.phone = "Phone is too long.";
  if (f.whatsapp.trim().length > 40) e.whatsapp = "WhatsApp number is too long.";
  if (f.dateOfBirth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dateOfBirth)) e.dateOfBirth = "Use a full date.";
    else if (f.dateOfBirth > todayIso()) e.dateOfBirth = "Date of birth cannot be in the future.";
  }
  if (f.internalNotes.length > 10000) e.internalNotes = "Notes must be 10,000 characters or fewer.";
  return e;
}

function errMsg(err: unknown): string {
  const e = err as { data?: { error?: string; message?: string }; message?: string } | null;
  return e?.data?.error ?? e?.data?.message ?? e?.message ?? "Something went wrong. Please try again.";
}

function fmtDate(d: string | null | undefined, pattern = "d MMM yyyy") {
  if (!d) return "—";
  try {
    return format(parseISO(d), pattern);
  } catch {
    return d;
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function useInvalidateClients() {
  const qc = useQueryClient();
  return (id?: number) => {
    qc.invalidateQueries({ queryKey: getListAdminClientRecordsQueryKey() });
    if (id) qc.invalidateQueries({ queryKey: getGetAdminClientRecordQueryKey(id) });
  };
}

export default function AdminClients() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().slice(0, 200)), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = search ? { search } : undefined;
  const list = useListAdminClientRecords(params, {
    query: {
      queryKey: getListAdminClientRecordsQueryKey(params),
      staleTime: STALE_MS,
      refetchInterval: REFETCH_MS,
      refetchOnWindowFocus: true,
    },
  });
  const clients = list.data ?? [];
  const showPanel = creating || selectedId !== null;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Client records</p>
          <h1 className="font-serif text-3xl mt-1">Clients</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">
            Contact details, private notes and linked bookings for each client.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setCreating(true); setSelectedId(null); }}
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
          data-testid="button-new-client"
        >
          <Plus className="w-4 h-4" /> New client
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Directory */}
        <section className={`bg-card border border-border flex flex-col min-h-[420px] ${showPanel ? "hidden lg:flex" : "flex"}`} aria-label="Client directory">
          <div className="p-4 border-b border-border">
            <label htmlFor="client-search" className="sr-only">Search clients</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="client-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, phone or WhatsApp"
                maxLength={200}
                className="w-full bg-background border border-border pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-search-clients"
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" data-testid="button-clear-search">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-3" aria-live="polite" data-testid="text-client-count">
              {list.isLoading ? "Loading…" : `${clients.length} ${clients.length === 1 ? "record" : "records"}${search ? ` matching "${search}"` : ""}`}
              {list.isFetching && !list.isLoading && " · refreshing"}
            </p>
          </div>

          {list.isLoading ? (
            <ul className="divide-y divide-border animate-pulse" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="p-4 flex gap-3 items-center">
                  <div className="w-10 h-10 bg-muted" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-1/2 bg-muted" /><div className="h-3 w-1/3 bg-muted" /></div>
                </li>
              ))}
            </ul>
          ) : list.isError ? (
            <div className="p-8 text-center space-y-3" role="alert">
              <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
              <p className="text-sm">Client records could not be loaded.</p>
              <p className="text-xs text-muted-foreground">{errMsg(list.error)}</p>
              <button type="button" onClick={() => list.refetch()} className="text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted" data-testid="button-retry-clients">Try again</button>
            </div>
          ) : clients.length === 0 ? (
            <div className="p-10 text-center space-y-3 my-auto">
              <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center font-serif text-lg text-muted-foreground">S</div>
              {search ? (
                <>
                  <p className="font-serif text-lg">No one matches that search.</p>
                  <p className="text-sm text-muted-foreground">Check the spelling, or try part of a phone number.</p>
                  <button type="button" onClick={() => setSearchInput("")} className="text-xs uppercase tracking-widest underline underline-offset-4" data-testid="button-empty-clear">Clear search</button>
                </>
              ) : (
                <>
                  <p className="font-serif text-lg">No client records yet.</p>
                  <p className="text-sm text-muted-foreground">Create the first record to start keeping notes and contact details.</p>
                  <button type="button" onClick={() => setCreating(true)} className="text-xs uppercase tracking-widest underline underline-offset-4" data-testid="button-empty-create">Create a client</button>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-y-auto lg:max-h-[calc(100dvh-280px)]">
              {clients.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedId(c.id); setCreating(false); }}
                      aria-current={active ? "true" : undefined}
                      className={`w-full text-left p-4 flex gap-3 items-center transition-colors ${active ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/40 border-l-2 border-transparent"}`}
                      data-testid={`row-client-${c.id}`}
                    >
                      <span className="w-10 h-10 shrink-0 bg-muted flex items-center justify-center font-serif text-sm" aria-hidden="true">{initials(c.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium truncate" data-testid={`text-client-name-${c.id}`}>{c.name}</span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {[c.email, c.phone, c.whatsapp && `WA ${c.whatsapp}`].filter(Boolean).join(" · ") || "No contact on file"}
                        </span>
                      </span>
                      <span className="hidden sm:block text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                        Updated {fmtDate(c.updatedAt, "d MMM")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Detail / create */}
        <section className={`${showPanel ? "block" : "hidden lg:block"}`} aria-label="Client record">
          {creating ? (
            <CreatePanel
              onCancel={() => setCreating(false)}
              onCreated={(id) => { setCreating(false); setSelectedId(id); }}
            />
          ) : selectedId !== null ? (
            <DetailPanel key={selectedId} id={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="bg-card border border-dashed border-border min-h-[420px] flex flex-col items-center justify-center text-center p-10">
              <p className="font-serif text-xl">Select a client</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">Choose a record from the directory to view contacts, notes and booking history.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CreatePanel({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: number) => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidateClients();
  const create = useCreateAdminClientRecord();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    create.mutate(
      {
        data: {
          name: form.name.trim(),
          email: orNull(form.email),
          phone: orNull(form.phone),
          whatsapp: orNull(form.whatsapp),
          dateOfBirth: form.dateOfBirth || null,
          internalNotes: form.internalNotes.trim() === "" ? null : form.internalNotes,
        },
      },
      {
        onSuccess: (rec) => {
          invalidate(rec.id);
          toast({ title: "Client created", description: `${rec.name} has been added.` });
          onCreated(rec.id);
        },
        onError: (err) => toast({ variant: "destructive", title: "Could not create client", description: errMsg(err) }),
      },
    );
  };

  return (
    <div className="bg-card border border-border">
      <PanelHeader eyebrow="New record" title="Create client" onBack={onCancel} />
      <ClientForm
        form={form}
        setForm={setForm}
        errors={errors}
        pending={create.isPending}
        submitLabel="Create client"
        pendingLabel="Creating…"
        onSubmit={submit}
        onCancel={onCancel}
        idPrefix="new"
      />
    </div>
  );
}

function DetailPanel({ id, onBack }: { id: number; onBack: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidateClients();
  const detail = useGetAdminClientRecord(id, {
    query: {
      queryKey: getGetAdminClientRecordQueryKey(id),
      enabled: !!id,
      staleTime: STALE_MS,
      refetchInterval: REFETCH_MS,
      refetchOnWindowFocus: true,
    },
  });
  const update = useUpdateAdminClientRecord();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});

  const startEdit = (rec: AdminClientRecordDetail) => {
    setForm(toForm(rec));
    setErrors({});
    setEditing(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    update.mutate(
      {
        id,
        data: {
          name: form.name.trim(),
          email: orNull(form.email),
          phone: orNull(form.phone),
          whatsapp: orNull(form.whatsapp),
          dateOfBirth: form.dateOfBirth || null,
          internalNotes: form.internalNotes.trim() === "" ? null : form.internalNotes,
        },
      },
      {
        onSuccess: (rec) => {
          invalidate(id);
          setEditing(false);
          toast({ title: "Changes saved", description: `${rec.name}'s record is up to date.` });
        },
        onError: (err) => toast({ variant: "destructive", title: "Could not save changes", description: errMsg(err) }),
      },
    );
  };

  if (detail.isLoading) {
    return (
      <div className="bg-card border border-border p-6 space-y-4 animate-pulse" aria-busy="true">
        <div className="h-4 w-24 bg-muted" /><div className="h-8 w-2/3 bg-muted" />
        <div className="grid grid-cols-2 gap-4"><div className="h-14 bg-muted" /><div className="h-14 bg-muted" /><div className="h-14 bg-muted" /><div className="h-14 bg-muted" /></div>
        <div className="h-40 bg-muted" />
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="bg-card border border-border p-8 text-center space-y-3" role="alert">
        <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
        <p className="text-sm">This client record could not be loaded.</p>
        <p className="text-xs text-muted-foreground">{errMsg(detail.error)}</p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={onBack} className="text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted lg:hidden" data-testid="button-detail-back-error">Back</button>
          <button type="button" onClick={() => detail.refetch()} className="text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted" data-testid="button-retry-detail">Try again</button>
        </div>
      </div>
    );
  }

  const rec = detail.data;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border">
        <PanelHeader
          eyebrow={`Client since ${fmtDate(rec.createdAt, "MMM yyyy")}`}
          title={rec.name}
          onBack={onBack}
          action={!editing ? (
            <button type="button" onClick={() => startEdit(rec)} className="text-xs uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted" data-testid="button-edit-client">Edit</button>
          ) : null}
        />
        {editing ? (
          <ClientForm
            form={form}
            setForm={setForm}
            errors={errors}
            pending={update.isPending}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            onSubmit={submit}
            onCancel={() => setEditing(false)}
            idPrefix={`edit-${id}`}
          />
        ) : (
          <div className="p-6 space-y-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border">
              <Fact icon={Mail} label="Email" value={rec.email} testId="text-client-email" />
              <Fact icon={Phone} label="Phone" value={rec.phone} testId="text-client-phone" />
              <Fact icon={MessageCircle} label="WhatsApp" value={rec.whatsapp} testId="text-client-whatsapp" />
              <Fact icon={Cake} label="Date of birth" value={rec.dateOfBirth ? fmtDate(rec.dateOfBirth) : null} testId="text-client-dob" />
            </dl>
            <div>
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Internal notes</h3>
              {rec.internalNotes ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/30 border-l-2 border-primary/50 p-4" data-testid="text-client-notes">{rec.internalNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic" data-testid="text-client-notes">No notes yet.</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">Staff-only. Never shown to the client.</p>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Last updated {fmtDate(rec.updatedAt, "d MMM yyyy, HH:mm")}</p>
          </div>
        )}
      </div>

      <BookingHistory rec={rec} />
    </div>
  );
}

const statusTone: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-emerald-700/10 text-emerald-800",
  cancelled: "bg-muted text-muted-foreground line-through",
  pending: "bg-amber-600/10 text-amber-800",
};

function BookingHistory({ rec }: { rec: AdminClientRecordDetail }) {
  const bookings = [...rec.bookings].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  return (
    <div className="bg-card border border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-serif text-xl">Linked bookings</h3>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground" data-testid="text-booking-count">{bookings.length} {bookings.length === 1 ? "booking" : "bookings"}</span>
        </div>
        <p className="flex gap-2 text-xs text-muted-foreground mt-3 leading-relaxed">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          Bookings made under this client. A booking is not a completed visit or a paid sale, so no spend totals are shown here. Check each appointment for its status.
        </p>
      </div>
      {bookings.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No bookings linked to this client yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {bookings.map((b) => (
            <li key={b.id} className="p-4 sm:px-6 grid grid-cols-[auto_1fr_auto] gap-4 items-center" data-testid={`row-booking-${b.id}`}>
              <div className="w-14 text-center border border-border py-1.5">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{fmtDate(b.date, "MMM")}</div>
                <div className="font-serif text-lg leading-none">{fmtDate(b.date, "d")}</div>
                <div className="text-[9px] text-muted-foreground">{fmtDate(b.date, "yyyy")}</div>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{b.serviceName ?? "Consultation"}</div>
                <div className="text-xs text-muted-foreground">{b.time} · Ref <span className="font-mono">{b.bookingRef}</span></div>
              </div>
              <span className={`text-[10px] uppercase tracking-widest px-2 py-1 ${statusTone[b.status.toLowerCase()] ?? "bg-muted text-foreground"}`} data-testid={`status-booking-${b.id}`}>{b.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PanelHeader({ eyebrow, title, onBack, action }: { eyebrow: string; title: string; onBack: () => void; action?: React.ReactNode }) {
  return (
    <div className="p-6 border-b border-border flex items-start gap-3">
      <button type="button" onClick={onBack} className="lg:hidden p-1 -ml-1 mt-4 text-muted-foreground hover:text-foreground" aria-label="Back to directory" data-testid="button-back-directory">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h2 className="font-serif text-2xl mt-1 break-words" data-testid="text-panel-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Fact({ icon: Icon, label, value, testId }: { icon: typeof Mail; label: string; value: string | null; testId: string }) {
  return (
    <div className="bg-card p-4">
      <dt className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground"><Icon className="w-3.5 h-3.5" aria-hidden="true" />{label}</dt>
      <dd className={`mt-1 text-sm break-words ${value ? "" : "text-muted-foreground italic"}`} data-testid={testId}>{value ?? "Not recorded"}</dd>
    </div>
  );
}

function ClientForm({
  form, setForm, errors, pending, submitLabel, pendingLabel, onSubmit, onCancel, idPrefix,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  errors: ReturnType<typeof validate>;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  idPrefix: string;
}) {
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const clear = (k: keyof FormState) => setForm({ ...form, [k]: "" });
  const inputCls = (bad?: string) =>
    `w-full bg-background border ${bad ? "border-destructive" : "border-border"} px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60`;

  const field = (k: keyof FormState, label: string, type: string, opts: { required?: boolean; hint?: string; max?: string; maxLength?: number } = {}) => {
    const id = `${idPrefix}-${k}`;
    const err = errors[k];
    return (
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label htmlFor={id} className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}{opts.required ? <span className="text-destructive" aria-hidden="true"> *</span> : <span className="normal-case tracking-normal"> (optional)</span>}
          </label>
          {!opts.required && form[k] && (
            <button type="button" onClick={() => clear(k)} disabled={pending} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground" aria-label={`Clear ${label}`} data-testid={`button-clear-${k}`}>Clear</button>
          )}
        </div>
        <input
          id={id}
          type={type}
          value={form[k]}
          onChange={set(k)}
          required={opts.required}
          max={opts.max}
          maxLength={opts.maxLength}
          disabled={pending}
          aria-invalid={!!err}
          aria-describedby={err ? `${id}-err` : opts.hint ? `${id}-hint` : undefined}
          className={inputCls(err)}
          data-testid={`input-${k}`}
        />
        {err ? <p id={`${id}-err`} className="text-xs text-destructive mt-1">{err}</p> : opts.hint ? <p id={`${id}-hint`} className="text-[11px] text-muted-foreground mt-1">{opts.hint}</p> : null}
      </div>
    );
  };

  const notesId = `${idPrefix}-internalNotes`;
  return (
    <form onSubmit={onSubmit} noValidate className="p-6 space-y-5">
      {field("name", "Full name", "text", { required: true, maxLength: 200 })}
      <fieldset className="space-y-4">
        <legend className="text-xs text-muted-foreground mb-3">At least one contact channel is required.</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("email", "Email", "email", { maxLength: 254 })}
          {field("phone", "Phone", "tel", { maxLength: 40 })}
          {field("whatsapp", "WhatsApp", "tel", { maxLength: 40 })}
          {field("dateOfBirth", "Date of birth", "date", { max: todayIso(), hint: "For the client record only. Does not opt them into birthday or marketing messages." })}
        </div>
        {errors.contact && <p className="text-xs text-destructive" role="alert" data-testid="error-contact">{errors.contact}</p>}
      </fieldset>
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label htmlFor={notesId} className="text-[10px] uppercase tracking-widest text-muted-foreground">Internal notes <span className="normal-case tracking-normal">(optional, staff only)</span></label>
          {form.internalNotes && (
            <button type="button" onClick={() => clear("internalNotes")} disabled={pending} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground" data-testid="button-clear-internalNotes">Clear</button>
          )}
        </div>
        <textarea
          id={notesId}
          rows={5}
          value={form.internalNotes}
          onChange={set("internalNotes")}
          maxLength={10000}
          disabled={pending}
          aria-invalid={!!errors.internalNotes}
          className={inputCls(errors.internalNotes)}
          data-testid="input-internalNotes"
        />
        {errors.internalNotes && <p className="text-xs text-destructive mt-1">{errors.internalNotes}</p>}
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={pending} className="text-xs uppercase tracking-widest border border-border px-5 py-3 hover:bg-muted disabled:opacity-60" data-testid="button-cancel-form">Cancel</button>
        <button type="submit" disabled={pending} aria-busy={pending} className="text-xs uppercase tracking-widest bg-primary text-primary-foreground px-5 py-3 hover:opacity-90 disabled:opacity-60" data-testid="button-submit-client">
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
