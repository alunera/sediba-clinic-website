import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  useListServices,
  getListServicesQueryKey,
  useGetAvailability,
  useGetAvailableDates,
  getGetAvailableDatesQueryKey,
  getGetAvailabilityQueryKey,
  useCreateAppointment,
  useInitiatePayment,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const CONCERNS = [
  "Skin concerns",
  "Acne",
  "Pigmentation",
  "Ageing / anti-ageing",
  "Skin health",
  "Treatment recommendation",
  "Product recommendation",
  "Other",
];

const STEPS = [
  { num: "01", label: "WELCOME" },
  { num: "02", label: "CONCERNS" },
  { num: "03", label: "DETAILS" },
  { num: "04", label: "TIME" },
  { num: "05", label: "CONFIRM" },
];

/* ─── Step indicator ───────────────────────────────────────────────────────── */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((s, i) => {
        const idx = i + 1;
        const active = idx === current;
        const done = idx < current;
        return (
          <div key={s.num} className="flex items-center">
            <div className="text-center w-20">
              <p className={`text-sm font-light mb-0.5 transition-colors ${active ? "text-primary" : done ? "text-foreground/40" : "text-foreground/20"}`}>
                {s.num}
              </p>
              <p className={`uppercase tracking-widest text-[9px] transition-colors ${active ? "text-primary" : done ? "text-foreground/40" : "text-foreground/20"}`}>
                {s.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 transition-colors ${done ? "bg-foreground/30" : "bg-foreground/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border p-8 md:p-12 relative">
      <div className="absolute top-0 left-0 w-full h-px bg-primary" />
      {children}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function BookConsultation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);

  // Step 2 — concerns
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [concernDetail, setConcernDetail] = useState("");
  const [isExistingClient, setIsExistingClient] = useState<boolean | null>(null);

  // Step 3 — details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Step 4 — date/time
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Step 5 — policy
  const [policyAgreed, setPolicyAgreed] = useState(false);

  /* ── Queries ── */
  const {
    data: services,
    isLoading: isLoadingServices,
    isError: isServicesError,
  } = useListServices({
    query: { queryKey: getListServicesQueryKey() },
  });

  const consultationService = services?.find(
    (s) => s.category === "consultation" || s.name.toLowerCase().includes("consultation"),
  );

  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const monthStr = format(visibleMonth, "yyyy-MM");
  const availableDatesParams = { month: monthStr };
  const { data: availableDatesData, isLoading: isLoadingDates } = useGetAvailableDates(
    availableDatesParams,
    { query: { queryKey: getGetAvailableDatesQueryKey(availableDatesParams), refetchOnWindowFocus: "always" } },
  );
  const availableDates = new Set(availableDatesData?.dates ?? []);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const availabilityParams = { date: dateStr, serviceId: consultationService?.id };
  const { data: availability, isLoading: isLoadingSlots } = useGetAvailability(
    availabilityParams,
    {
      query: {
        enabled: !!selectedDate && !!consultationService,
        queryKey: getGetAvailabilityQueryKey(availabilityParams),
      },
    },
  );

  const createAppointment = useCreateAppointment();
  const initiatePayment = useInitiatePayment();
  const [redirecting, setRedirecting] = useState(false);

  /* ── Helpers ── */
  function toggleConcern(c: string) {
    setSelectedConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function buildNotes(): string {
    const parts: string[] = [];
    if (selectedConcerns.length) parts.push(`Concerns: ${selectedConcerns.join(", ")}`);
    if (concernDetail.trim()) parts.push(`Additional information: ${concernDetail.trim()}`);
    if (isExistingClient !== null)
      parts.push(`Existing client: ${isExistingClient ? "Yes" : "No"}`);
    if (additionalNotes.trim()) parts.push(`Notes: ${additionalNotes.trim()}`);
    return parts.join("\n");
  }

  function handleConfirm() {
    if (!consultationService || !selectedDate || !selectedTime || !firstName || !clientEmail || !clientPhone || !policyAgreed) {
      toast({ title: "Incomplete details", description: "Please fill in all required fields and agree to the booking policy.", variant: "destructive" });
      return;
    }

    createAppointment.mutate(
      {
        data: {
          serviceId: consultationService.id,
          date: format(selectedDate, "yyyy-MM-dd"),
          time: selectedTime,
          clientName: `${firstName.trim()} ${lastName.trim()}`.trim(),
          clientEmail,
          clientPhone,
          clientWhatsapp: clientWhatsapp || undefined,
          notes: buildNotes() || undefined,
          policyAgreed: true,
          appointmentType: "consultation",
        } as Parameters<typeof createAppointment.mutate>[0]["data"],
      },
      {
        onSuccess: (data) => {
          if (data.status === "pending_payment") {
            setRedirecting(true);
            initiatePayment.mutate(
              { data: { bookingRef: data.bookingRef } },
              {
                onSuccess: (payment) => {
                  toast({
                    title: "Consultation Reserved",
                    description: "Redirecting you to our secure payment partner…",
                  });
                  window.location.assign(payment.url);
                },
                onError: () => {
                  setRedirecting(false);
                  setLocation(`/booking-confirmation?ref=${data.bookingRef}&payment=retry`);
                },
              },
            );
            return;
          }
          setLocation(`/booking-confirmation?ref=${data.bookingRef}`);
        },
        onError: () => {
          toast({ title: "Booking failed", description: "We couldn't secure your consultation. Please try again.", variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-24 bg-background">
      <div className="container max-w-2xl px-6 mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">
            Consultation
          </span>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-4">
            Book Your Consultation
          </h1>
          <p className="text-muted-foreground font-light max-w-md mx-auto">
            Follow the steps below to reserve your personalised consultation with Sediba Wellness.
          </p>
        </div>

        <StepIndicator current={step} />

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <Card>
            <h2 className="font-serif text-2xl text-foreground mb-6">
              Not sure which treatment is right for you?
            </h2>
            <p className="text-muted-foreground font-light leading-relaxed mb-6">
              Book a consultation with Sediba Wellness so we can better understand your
              concerns, goals and needs, and determine the most appropriate next step for
              your skin and wellness journey.
            </p>
            <p className="text-muted-foreground font-light leading-relaxed mb-10">
              This personalised 30-minute session allows our practitioner to assess your
              skin, listen to your goals, and create a tailored treatment plan designed
              around you.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                className="rounded-none uppercase tracking-widest text-xs px-10 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* ── Step 2: Concerns ── */}
        {step === 2 && (
          <Card>
            <h2 className="font-serif text-xl text-foreground mb-8">
              Tell us what you would like help with
            </h2>

            <div className="mb-8">
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-4 block">
                Select all that apply
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {CONCERNS.map((c) => {
                  const selected = selectedConcerns.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleConcern(c)}
                      className={`text-left px-4 py-3 border text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/40"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-8">
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                Tell us a little about what you would like help with
              </Label>
              <Textarea
                value={concernDetail}
                onChange={(e) => setConcernDetail(e.target.value)}
                className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary min-h-[100px]"
                placeholder="Describe your concerns, goals or anything else you would like the practitioner to know."
              />
            </div>

            <div className="mb-10">
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-4 block">
                Have you visited Sediba Wellness before?
              </Label>
              <div className="flex gap-4">
                {[
                  { label: "Yes, I am an existing client", value: true },
                  { label: "No, this will be my first visit", value: false },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setIsExistingClient(opt.value)}
                    className={`flex-1 px-4 py-3 border text-sm text-left transition-colors ${
                      isExistingClient === opt.value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-none uppercase tracking-widest text-xs px-8 border-border">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedConcerns.length === 0 || isExistingClient === null}
                className="rounded-none uppercase tracking-widest text-xs px-10 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* ── Step 3: Client Details ── */}
        {step === 3 && (
          <Card>
            <h2 className="font-serif text-xl text-foreground mb-8">Your Details</h2>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                    First Name <span className="text-primary">*</span>
                  </Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary h-12"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                    Last Name
                  </Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary h-12"
                    placeholder="Smith"
                  />
                </div>
              </div>
              <div>
                <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                  Email Address <span className="text-primary">*</span>
                </Label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary h-12"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                  Mobile Number <span className="text-primary">*</span>
                </Label>
                <Input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary h-12"
                  placeholder="+27 82 123 4567"
                />
              </div>
              <div>
                <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                  WhatsApp Number (if different)
                </Label>
                <Input
                  type="tel"
                  value={clientWhatsapp}
                  onChange={(e) => setClientWhatsapp(e.target.value)}
                  className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary h-12"
                  placeholder="+27 82 123 4567"
                />
              </div>
              <div>
                <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                  Additional Notes (Optional)
                </Label>
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary min-h-[80px]"
                  placeholder="Anything else you would like us to know before your consultation."
                />
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-none uppercase tracking-widest text-xs px-8 border-border">
                Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!firstName || !clientEmail || !clientPhone}
                className="rounded-none uppercase tracking-widest text-xs px-10 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* ── Step 4: Date & Time ── */}
        {step === 4 && (
          <Card>
            <h2 className="font-serif text-xl text-foreground mb-8">Select a Date & Time</h2>

            {isLoadingServices && (
              <p className="text-muted-foreground text-sm mb-8">
                Loading consultation availability…
              </p>
            )}

            {isServicesError && (
              <p className="text-muted-foreground text-sm mb-8">
                We couldn't load consultation availability. Please refresh the page and try again.
              </p>
            )}

            {!isLoadingServices && !isServicesError && !consultationService && (
              <p className="text-muted-foreground text-sm mb-8">
                The consultation service has not been configured yet. Please contact us directly to book.
              </p>
            )}

            {consultationService && (
              <>
                <div className="flex justify-center mb-8">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    month={visibleMonth}
                    onMonthChange={(m) => setVisibleMonth(m)}
                    onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                    disabled={(d) => !availableDates.has(format(d, "yyyy-MM-dd"))}
                    modifiers={{
                      available: (d: Date) => availableDates.has(format(d, "yyyy-MM-dd")),
                    }}
                    modifiersClassNames={{
                      available: "font-semibold [&>button]:bg-primary/10 [&>button]:hover:bg-primary/20",
                    }}
                    className="border border-border rounded-none"
                  />
                </div>
                {!isLoadingDates && availableDates.size === 0 && (
                  <p className="text-xs text-muted-foreground text-center mb-6">
                    No availability in {format(visibleMonth, "MMMM yyyy")}. Try another month.
                  </p>
                )}

                {selectedDate && (
                  <div>
                    <p className="uppercase tracking-widest text-[10px] text-muted-foreground mb-4">
                      Available times for {format(selectedDate, "MMMM d, yyyy")}
                    </p>
                    {isLoadingSlots ? (
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-10 bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {(availability ?? []).filter((s) => s.available).map((slot) => (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-2.5 text-sm border transition-colors ${
                              selectedTime === slot.time
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-foreground hover:border-primary"
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                        {(availability ?? []).filter((s) => s.available).length === 0 && (
                          <p className="col-span-4 text-sm text-muted-foreground py-4">
                            No available slots on this date. Please select another day.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-none uppercase tracking-widest text-xs px-8 border-border">
                Back
              </Button>
              <Button
                onClick={() => setStep(5)}
                disabled={!selectedDate || !selectedTime}
                className="rounded-none uppercase tracking-widest text-xs px-10 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* ── Step 5: Confirm ── */}
        {step === 5 && consultationService && selectedDate && selectedTime && (
          <Card>
            <h2 className="font-serif text-xl text-foreground mb-8">Review & Confirm</h2>

            {/* Summary */}
            <div className="space-y-4 pb-8 mb-8 border-b border-border">
              {[
                { label: "Consultation Type", value: "Skin & Wellness Consultation" },
                { label: "Client", value: `${firstName} ${lastName}`.trim() },
                { label: "Date", value: format(selectedDate, "MMMM d, yyyy") },
                { label: "Time", value: selectedTime },
                { label: "Duration", value: `${consultationService.duration} min` },
                { label: "Amount", value: `R${consultationService.price.toFixed(2)}` },
                { label: "Concerns", value: selectedConcerns.join(", ") },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-baseline gap-4">
                  <span className="uppercase tracking-widest text-[10px] text-muted-foreground shrink-0">{label}</span>
                  <span className="text-sm text-foreground text-right">{value}</span>
                </div>
              ))}
            </div>

            {/* Policy */}
            <div className="mb-8 p-6 bg-muted/30 border border-border">
              <p className="uppercase tracking-widest text-[10px] text-muted-foreground mb-4">Booking Policy</p>
              <ul className="space-y-2 text-sm text-muted-foreground font-light">
                <li>Payment is required to secure your consultation appointment.</li>
                <li>Cancellations made less than 24 hours in advance forfeit the consultation fee.</li>
                <li>Rescheduling is permitted with a minimum of 24 hours notice.</li>
                <li>Please arrive 5 minutes before your consultation time.</li>
              </ul>
              <label className="flex items-center gap-3 mt-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyAgreed}
                  onChange={(e) => setPolicyAgreed(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm text-foreground">I agree to the booking policy</span>
              </label>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)} className="rounded-none uppercase tracking-widest text-xs px-8 border-border">
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!policyAgreed || createAppointment.isPending || redirecting || initiatePayment.isPending}
                className="rounded-none uppercase tracking-widest text-xs px-10 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {createAppointment.isPending
                  ? "Reserving..."
                  : redirecting || initiatePayment.isPending
                    ? "Opening Payment..."
                    : "Confirm & Pay"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
