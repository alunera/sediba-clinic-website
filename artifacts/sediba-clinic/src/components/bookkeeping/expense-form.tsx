import { useRef, useState, type FormEvent } from "react";
import { BookExpenseInputCategory, BookExpenseInputMethod, useCreateBookExpense } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { createIdempotencyKeeper, errMsg, formatRand, jhbToday, methodLabel, parseRandToCents } from "@/lib/money";
import { DATE_RE, btnPrimary, categoryLabel, inputCls, labelCls, useInvalidateBooks } from "./shared";

type Cat = (typeof BookExpenseInputCategory)[keyof typeof BookExpenseInputCategory];
type Method = (typeof BookExpenseInputMethod)[keyof typeof BookExpenseInputMethod];

export function ExpenseForm() {
  const today = jhbToday();
  const { toast } = useToast();
  const invalidate = useInvalidateBooks();
  const keeper = useRef(createIdempotencyKeeper());
  const create = useCreateBookExpense();
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<Cat>("consumables");
  const [payee, setPayee] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("eft");
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const cents = parseRandToCents(amount);
    if (!DATE_RE.test(date)) return setError("Choose the date the money left.");
    if (date > jhbToday()) return setError("Future dates are not allowed. Only record expenses already paid.");
    if (!payee.trim()) return setError("Enter who was paid.");
    if (!reference.trim()) return setError("Enter a reference (slip, invoice or proof of payment number).");
    if (cents === null || cents < 1 || cents > 100_000_000) return setError("Enter a valid amount, for example 1250.00.");
    if (!paid) return setError("Confirm this expense has already been paid.");
    setError(null);
    const body = { date, category, payee: payee.trim(), reference: reference.trim(), amountCents: cents, method, paid: true as const };
    const requestId = keeper.current.get(body);
    create.mutate({ data: { requestId, ...body } }, {
      onSuccess: () => {
        keeper.current.reset();
        setPayee(""); setReference(""); setAmount(""); setPaid(false);
        toast({ title: "Expense recorded", description: `${formatRand(cents)} to ${body.payee}` });
        invalidate();
      },
      onError: (err) => setError(`${errMsg(err)} Your entry is kept; retrying sends the same request and will not duplicate it.`),
    });
  };

  const cents = parseRandToCents(amount);
  return (
    <form onSubmit={submit} noValidate className="bg-card border border-border p-4 sm:p-6 space-y-4" aria-label="Record paid expense" data-testid="form-expense">
      <div>
        <h2 className="font-serif text-xl">Record a paid expense</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Only money that has already left the business. Unpaid bills do not belong here. If an amount already includes a provider or bank fee, enter it once here and do not add it again as a deposit fee.</p>
      </div>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="ex-date" className={labelCls}>Date paid</label>
          <input id="ex-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} data-testid="input-expense-date" /></div>
        <div><label htmlFor="ex-amount" className={labelCls}>Amount (R)</label>
          <input id="ex-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`${inputCls} font-mono`} data-testid="input-expense-amount" />
          {amount && <p className="text-[11px] mt-1 text-muted-foreground">{cents === null ? "Not a valid amount" : formatRand(cents)}</p>}</div>
        <div><label htmlFor="ex-cat" className={labelCls}>Category</label>
          <select id="ex-cat" value={category} onChange={(e) => setCategory(e.target.value as Cat)} className={inputCls} data-testid="select-expense-category">
            {Object.values(BookExpenseInputCategory).map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select></div>
        <div><label htmlFor="ex-method" className={labelCls}>Paid by</label>
          <select id="ex-method" value={method} onChange={(e) => setMethod(e.target.value as Method)} className={inputCls} data-testid="select-expense-method">
            {Object.values(BookExpenseInputMethod).map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
          </select></div>
        <div><label htmlFor="ex-payee" className={labelCls}>Payee</label>
          <input id="ex-payee" value={payee} maxLength={200} onChange={(e) => setPayee(e.target.value)} className={inputCls} data-testid="input-expense-payee" /></div>
        <div><label htmlFor="ex-ref" className={labelCls}>Reference</label>
          <input id="ex-ref" value={reference} maxLength={1000} onChange={(e) => setReference(e.target.value)} placeholder="Invoice / slip no." className={inputCls} data-testid="input-expense-reference" /></div>
        <label className="sm:col-span-2 flex items-start gap-3 text-sm border border-border p-3 cursor-pointer">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" data-testid="checkbox-expense-paid" />
          <span>I confirm this money has <b>already been paid</b>. Entries cannot be edited or deleted later, only voided with a reason.</span>
        </label>
      </fieldset>
      {error && <p className="text-xs text-destructive" role="alert" data-testid="error-expense">{error}</p>}
      <button type="submit" disabled={pending} className={btnPrimary} data-testid="button-submit-expense">{pending ? "Recording..." : "Record expense"}</button>
    </form>
  );
}
