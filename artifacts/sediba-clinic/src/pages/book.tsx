import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListServices, 
  getListServicesQueryKey,
  useGetAvailability,
  getGetAvailabilityQueryKey,
  useGetAvailableDates,
  getGetAvailableDatesQueryKey,
  useCreateAppointment,
  useInitiatePayment
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayPrice, menuIndex } from "@/lib/treatments";

export default function Book() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // URL params
  const searchParams = new URLSearchParams(window.location.search);
  const defaultServiceId = searchParams.get("service") ? parseInt(searchParams.get("service")!) : null;
  const treatmentParam = searchParams.get("treatment");

  // Form State
  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(defaultServiceId);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [policyAgreed, setPolicyAgreed] = useState(false);

  // Queries
  const { data: services, isLoading: isLoadingServices } = useListServices({
    query: { queryKey: getListServicesQueryKey() }
  });

  // Bookable treatments in official menu order (consultations have their own page)
  const bookableServices = useMemo(
    () =>
      (services ?? [])
        .filter((s) => s.category !== "consultation")
        .sort((a, b) => menuIndex(a.name) - menuIndex(b.name)),
    [services]
  );

  const selectedService = bookableServices.find((s) => s.id === selectedServiceId);

  // Once services load: validate any legacy ?service=<id> selection, then
  // pre-select the treatment passed from the Services page (?treatment=Name)
  useEffect(() => {
    if (bookableServices.length === 0) return;
    if (selectedServiceId !== null) {
      // Clear selections that aren't a bookable treatment (e.g. stale/invalid id)
      if (!bookableServices.some((s) => s.id === selectedServiceId)) {
        setSelectedServiceId(null);
      }
      return;
    }
    if (treatmentParam) {
      const match = bookableServices.find(
        (s) => s.name.trim().toLowerCase() === treatmentParam.trim().toLowerCase()
      );
      if (match) setSelectedServiceId(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookableServices]);

  // Dates in the visible month that still have at least one open slot,
  // as configured by the clinic in the admin panel.
  const monthStr = format(visibleMonth, "yyyy-MM");
  const availableDatesParams = { month: monthStr };
  const { data: availableDatesData, isLoading: isLoadingDates } = useGetAvailableDates(
    availableDatesParams,
    { query: { queryKey: getGetAvailableDatesQueryKey(availableDatesParams), refetchOnWindowFocus: "always" } }
  );
  const availableDates = useMemo(
    () => new Set(availableDatesData?.dates ?? []),
    [availableDatesData]
  );

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const availabilityParams = { date: dateStr, serviceId: selectedServiceId || undefined };
  const { data: availability, isLoading: isLoadingAvailability } = useGetAvailability(
    availabilityParams,
    { query: { enabled: !!selectedDate && !!selectedServiceId, queryKey: getGetAvailabilityQueryKey(availabilityParams) } }
  );

  const createAppointment = useCreateAppointment();
  const initiatePayment = useInitiatePayment();
  const [redirecting, setRedirecting] = useState(false);
  const queryClient = useQueryClient();


  const handleBook = () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName || !clientEmail || !clientPhone || !policyAgreed) {
      toast({ title: "Incomplete details", description: "Please fill in all required fields and agree to the policies.", variant: "destructive" });
      return;
    }

    createAppointment.mutate({
      data: {
        serviceId: selectedService.id,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedTime,
        clientName,
        clientEmail,
        clientPhone,
        clientWhatsapp: clientWhatsapp || undefined,
        notes: notes || undefined,
        policyAgreed: true,
      }
    }, {
      onSuccess: (data) => {
        if (data.status === "pending_payment") {
          // Slot is reserved — now take the client to secure payment.
          setRedirecting(true);
          initiatePayment.mutate({ data: { bookingRef: data.bookingRef } }, {
            onSuccess: (payment) => {
              toast({
                title: "Slot Reserved",
                description: "Redirecting you to our secure payment partner…",
              });
              window.location.assign(payment.url);
            },
            onError: () => {
              setRedirecting(false);
              // Slot stays reserved briefly — send them to the confirmation
              // page where payment can be retried.
              setLocation(`/booking-confirmation?ref=${data.bookingRef}&payment=retry`);
            },
          });
          return;
        }
        toast({
          title: "Reservation Confirmed",
          description: "Your appointment has been successfully booked.",
        });
        setLocation(`/booking-confirmation?ref=${data.bookingRef}`);
      },
      onError: () => {
        // The slot may have just been taken or removed — refresh availability
        // so the calendar and time grid reflect the current state.
        queryClient.invalidateQueries({ queryKey: getGetAvailableDatesQueryKey(availableDatesParams) });
        if (dateStr) {
          queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey(availabilityParams) });
        }
        toast({
          title: "Booking Failed",
          description: "This time may no longer be available. Please pick another slot and try again.",
          variant: "destructive"
        });
      }
    });
  };

  const steps = ["Treatment", "Time", "Details", "Policy", "Confirm"];

  return (
    <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center">
      <div className="container max-w-4xl px-6">
        <div className="text-center mb-16">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">Reservations</span>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-6">Secure Your Time</h1>
          <p className="text-muted-foreground font-light max-w-xl mx-auto">
            Follow the steps to reserve your bespoke aesthetic and wellness experience.
          </p>
        </div>

        <div className="bg-card border border-border p-8 md:p-12">
          {/* Step Indicators */}
          <div className="flex justify-between border-b border-border pb-8 mb-8 overflow-x-auto gap-4">
            {steps.map((label, idx) => (
              <div 
                key={label} 
                className={`flex flex-col items-center flex-1 min-w-[80px] ${step === idx + 1 ? "text-primary" : step > idx + 1 ? "text-foreground" : "text-muted-foreground/50"}`}
              >
                <span className="font-serif text-xl mb-2">0{idx + 1}</span>
                <span className="text-[10px] uppercase tracking-widest">{label}</span>
              </div>
            ))}
          </div>

          {/* STEP 1: Service Selection */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-serif text-2xl text-foreground mb-6">Select Treatment</h2>
              {isLoadingServices ? (
                <div className="h-16 bg-muted animate-pulse border border-border" />
              ) : (
                <div className="space-y-6">
                  <div>
                    <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                      Treatment
                    </Label>
                    <Select
                      value={selectedServiceId !== null ? String(selectedServiceId) : ""}
                      onValueChange={(v) => setSelectedServiceId(parseInt(v))}
                    >
                      <SelectTrigger className="rounded-none border-border bg-background h-14 text-left focus:ring-1 focus:ring-primary">
                        <SelectValue placeholder="Select a treatment" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none max-h-[320px]">
                        {bookableServices.map((service) => (
                          <SelectItem key={service.id} value={String(service.id)}>
                            {service.name} &mdash; {displayPrice(service.name, service.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedService && (
                    <div className="p-6 border border-primary bg-primary/5">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                        You are booking
                      </span>
                      <h3 className="font-serif text-lg text-foreground mb-1">{selectedService.name}</h3>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {selectedService.duration} Min &bull; {displayPrice(selectedService.name, selectedService.price)}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!selectedService}
                  className="rounded-none uppercase tracking-widest text-xs px-8"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Compact booking summary, visible after the treatment is chosen */}
          {step >= 2 && selectedService && (
            <div className="mb-8 border border-border bg-muted/20 px-6 py-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Treatment</span>
                <span className="font-serif text-foreground">{selectedService.name}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Price</span>
                <span className="text-foreground">{displayPrice(selectedService.name, selectedService.price)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Date</span>
                <span className="text-foreground">{selectedDate ? format(selectedDate, "d MMM yyyy") : "Not selected"}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Time</span>
                <span className="text-foreground">{selectedTime ?? "Not selected"}</span>
              </div>
            </div>
          )}

          {/* STEP 2: Date & Time */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-serif text-2xl text-foreground mb-6">Select Date & Time</h2>
              <div className="grid md:grid-cols-2 gap-12">
                <div>
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-4 block">Date</Label>
                  <div className="border border-border p-4 flex justify-center bg-background">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      month={visibleMonth}
                      onMonthChange={(m) => setVisibleMonth(m)}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setSelectedTime(null);
                      }}
                      disabled={(date) => !availableDates.has(format(date, "yyyy-MM-dd"))}
                      modifiers={{
                        available: (date: Date) => availableDates.has(format(date, "yyyy-MM-dd")),
                      }}
                      modifiersClassNames={{
                        available: "font-semibold [&>button]:bg-primary/10 [&>button]:hover:bg-primary/20",
                      }}
                      className="font-sans"
                    />
                  </div>
                  {!isLoadingDates && availableDates.size === 0 && (
                    <p className="mt-3 text-xs text-muted-foreground text-center">
                      No availability in {format(visibleMonth, "MMMM yyyy")}. Try another month.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-4 block">Available Times</Label>
                  {!selectedDate ? (
                    <div className="h-full flex items-center justify-center border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Select a date to view availability
                    </div>
                  ) : isLoadingAvailability ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted animate-pulse border border-border" />)}
                    </div>
                  ) : availability && availability.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                      {availability.map(slot => (
                        <button
                          key={slot.time}
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-3 text-sm transition-colors border ${
                            !slot.available 
                              ? "opacity-50 cursor-not-allowed bg-muted/50 border-transparent text-muted-foreground" 
                              : selectedTime === slot.time
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-transparent border-border hover:border-primary text-foreground"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No availability on this date
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-8 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setStep(1)} 
                  className="rounded-none uppercase tracking-widest text-xs px-8 border-border text-foreground"
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  disabled={!selectedDate || !selectedTime}
                  className="rounded-none uppercase tracking-widest text-xs px-8"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Details */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-serif text-2xl text-foreground mb-6">Client Details</h2>
              
              <div className="space-y-4">
                <div>
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Full Name</Label>
                  <Input 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                    className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Email</Label>
                    <Input 
                      type="email"
                      value={clientEmail} 
                      onChange={e => setClientEmail(e.target.value)} 
                      className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div>
                    <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Phone</Label>
                    <Input 
                      type="tel"
                      value={clientPhone} 
                      onChange={e => setClientPhone(e.target.value)} 
                      className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
                      placeholder="+27 82 123 4567"
                    />
                  </div>
                </div>
                <div>
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">WhatsApp Number (Optional)</Label>
                  <Input 
                    type="tel"
                    value={clientWhatsapp} 
                    onChange={e => setClientWhatsapp(e.target.value)} 
                    className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
                    placeholder="+27 82 123 4567"
                  />
                </div>
                <div>
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Notes (Optional)</Label>
                  <Textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary min-h-[100px]"
                    placeholder="Any specific concerns or requests?"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setStep(2)} 
                  className="rounded-none uppercase tracking-widest text-xs px-8 border-border text-foreground"
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(4)} 
                  disabled={!clientName || !clientEmail || !clientPhone}
                  className="rounded-none uppercase tracking-widest text-xs px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Policy */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-serif text-2xl text-foreground mb-6">Booking Policies</h2>
              
              <div className="bg-muted/30 p-6 border border-border space-y-4 text-sm text-foreground/80 leading-relaxed font-light">
                <p>Please review our booking policies before confirming your appointment:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>100% payment is required to secure your appointment.</li>
                  <li>Cancellations made less than 24 hours before your appointment will forfeit the full booking amount.</li>
                  <li>Rescheduling is permitted with a minimum of 24 hours' notice.</li>
                  <li>Please arrive 5 minutes before your appointment time.</li>
                </ul>
              </div>

              <div className="flex items-center space-x-3 mt-6">
                <input 
                  type="checkbox" 
                  id="policy" 
                  checked={policyAgreed}
                  onChange={(e) => setPolicyAgreed(e.target.checked)}
                  className="w-5 h-5 accent-primary border-border bg-background"
                />
                <label htmlFor="policy" className="text-sm font-medium leading-none cursor-pointer">
                  I agree to the booking policy
                </label>
              </div>

              <div className="mt-8 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setStep(3)} 
                  className="rounded-none uppercase tracking-widest text-xs px-8 border-border text-foreground"
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(5)} 
                  disabled={!policyAgreed}
                  className="rounded-none uppercase tracking-widest text-xs px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Confirm */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-serif text-2xl text-foreground mb-6">Review & Confirm</h2>
              
              <div className="bg-muted/10 p-8 border border-border">
                <h4 className="font-serif text-xl mb-6 border-b border-border pb-4">Reservation Summary</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="text-muted-foreground uppercase tracking-widest text-[10px] block mb-1">Client Details</span>
                      <p className="font-medium text-foreground">{clientName}</p>
                      <p className="text-foreground/80">{clientEmail}</p>
                      <p className="text-foreground/80">{clientPhone}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="text-muted-foreground uppercase tracking-widest text-[10px] block mb-1">Appointment Details</span>
                      <p className="font-medium text-foreground">{selectedService?.name}</p>
                      <p className="text-foreground/80">{selectedDate && format(selectedDate, "MMMM d, yyyy")} at {selectedTime}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 mt-6 border-t border-border">
                  <span className="text-muted-foreground uppercase tracking-widest text-xs">Total Amount</span>
                  <span className="font-serif text-2xl text-foreground">
                    {selectedService ? displayPrice(selectedService.name, selectedService.price) : ""}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setStep(4)} 
                  className="rounded-none uppercase tracking-widest text-xs px-8 border-border text-foreground"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleBook} 
                  disabled={createAppointment.isPending || redirecting}
                  className="rounded-none uppercase tracking-widest text-xs px-10 py-6 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {redirecting
                    ? "Redirecting to Payment..."
                    : createAppointment.isPending
                      ? "Reserving..."
                      : "Proceed to Secure Payment"}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
