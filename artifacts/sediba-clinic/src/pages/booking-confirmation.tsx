import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  useGetAppointmentByRef,
  getGetAppointmentByRefQueryKey,
  useGetPaymentStatus,
  getGetPaymentStatusQueryKey,
  useInitiatePayment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function BookingConfirmation() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const ref = searchParams.get("ref");
  const paymentParam = searchParams.get("payment"); // return | cancelled | failed | retry | null
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  const { data: appointment, isLoading, isError } = useGetAppointmentByRef(ref || "", {
    query: {
      enabled: !!ref,
      queryKey: getGetAppointmentByRefQueryKey(ref || "")
    }
  });

  // While the booking awaits payment verification, poll the payment status —
  // the Yoco webhook may land seconds after the client returns.
  const awaitingPayment =
    !!appointment && (appointment.status === "pending_payment" || appointment.status === "payment_failed");
  const statusParams = { ref: ref || "" };
  const { data: paymentStatus } = useGetPaymentStatus(statusParams, {
    query: {
      enabled: !!ref && !!appointment && appointment.totalAmountCents > 0,
      queryKey: getGetPaymentStatusQueryKey(statusParams),
      refetchInterval: awaitingPayment ? 3000 : false,
    },
  });

  // When polling reports the booking flipped to confirmed, refresh it.
  useEffect(() => {
    if (paymentStatus && appointment && paymentStatus.bookingStatus !== appointment.status) {
      queryClient.invalidateQueries({ queryKey: getGetAppointmentByRefQueryKey(ref || "") });
    }
  }, [paymentStatus, appointment, queryClient, ref]);

  const initiatePayment = useInitiatePayment();
  const handleRetryPayment = () => {
    if (!ref) return;
    setRetrying(true);
    initiatePayment.mutate({ data: { bookingRef: ref } }, {
      onSuccess: (payment) => window.location.assign(payment.url),
      onError: () => setRetrying(false),
    });
  };

  if (!ref) {
    return (
      <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-3xl mb-4">Invalid Booking Reference</h1>
        <p className="text-muted-foreground mb-8">We couldn't find a booking reference in your link.</p>
        <Button onClick={() => setLocation("/")} className="rounded-none uppercase tracking-widest text-xs px-8">Return Home</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center">
        <div className="container max-w-2xl px-6 text-center">
          <div className="h-10 w-64 bg-muted animate-pulse mx-auto mb-6" />
          <div className="h-64 w-full bg-muted animate-pulse border border-border" />
        </div>
      </div>
    );
  }

  if (isError || !appointment) {
    return (
      <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-3xl mb-4">Booking Not Found</h1>
        <p className="text-muted-foreground mb-8">We couldn't find the booking details for reference: {ref}</p>
        <Button onClick={() => setLocation("/")} className="rounded-none uppercase tracking-widest text-xs px-8">Return Home</Button>
      </div>
    );
  }

  // ── Payment-state screens ────────────────────────────────────────────────
  if (appointment.status === "pending_payment" || appointment.status === "payment_failed") {
    const checkoutDidNotOpen = paymentParam === "retry";
    const failed =
      appointment.status === "payment_failed" ||
      paymentParam === "cancelled" ||
      paymentParam === "failed" ||
      checkoutDidNotOpen;
    return (
      <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center">
        <div className="container max-w-2xl px-6 text-center">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">
            {checkoutDidNotOpen ? "Payment Required" : failed ? "Payment Incomplete" : "Awaiting Payment"}
          </span>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-4">
            {checkoutDidNotOpen
              ? "The Payment Page Did Not Open"
              : failed
                ? "Your Payment Was Not Completed"
                : "Verifying Your Payment"}
          </h1>
          <p className="text-muted-foreground font-light mb-8">
            {checkoutDidNotOpen
              ? "Your consultation is reserved for a short while, but no payment has been taken. Select Complete Payment to open the secure Yoco checkout."
              : failed
              ? "Your slot is still reserved for a short while. Complete payment now to secure your appointment."
              : "One moment — we're confirming your payment with our payment partner. This page updates automatically."}
          </p>

          <div className="bg-card border border-border p-8 mb-8">
            <span className="uppercase tracking-widest text-[10px] text-muted-foreground block mb-2">Booking Reference</span>
            <span className="font-mono text-2xl tracking-[0.2em] block mb-6">{appointment.bookingRef}</span>
            <div className="flex justify-between items-center border-t border-border pt-6">
              <span className="text-muted-foreground text-sm uppercase tracking-widest text-[10px]">Amount Due</span>
              <span className="font-serif text-xl">R{(appointment.totalAmountCents / 100).toFixed(2)}</span>
            </div>
          </div>

          {!failed && (
            <div className="flex items-center justify-center gap-3 mb-8 text-muted-foreground text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              Checking payment status…
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              onClick={handleRetryPayment}
              disabled={retrying || initiatePayment.isPending}
              className="rounded-none uppercase tracking-widest text-xs px-10 py-6 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {retrying ? "Redirecting..." : failed ? "Complete Payment" : "Reopen Payment Page"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="rounded-none uppercase tracking-widest text-xs px-8 border-border"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (appointment.status === "cancelled") {
    return (
      <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-3xl mb-4">Booking No Longer Active</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          This reservation ({appointment.bookingRef}) was cancelled — unpaid bookings are released after 30 minutes.
          Please make a new booking.
        </p>
        <Button onClick={() => setLocation("/book")} className="rounded-none uppercase tracking-widest text-xs px-8">
          Book Again
        </Button>
      </div>
    );
  }

  const paymentWasVerified =
    appointment.appointmentType === "treatment" ||
    paymentStatus?.paymentStatus === "complete";

  const handleCalendarDownload = () => {
    // Generate a basic .ics file content
    const startObj = new Date(`${appointment.date}T${appointment.time}`);
    // Assume 60 min duration for calendar invite if we don't have duration in the appointment object
    const endObj = new Date(startObj.getTime() + 60 * 60 * 1000); 
    
    const formatIcsDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split('.')[0] + "Z";
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${formatIcsDate(startObj)}`,
      `DTEND:${formatIcsDate(endObj)}`,
      `SUMMARY:${appointment.serviceName} at Sediba Wellness`,
      `DESCRIPTION:Booking Ref: ${appointment.bookingRef}`,
      "LOCATION:Sediba Aesthetic & Wellness Clinic",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Sediba_Booking_${appointment.bookingRef}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center">
      <div className="container max-w-2xl px-6">
        <div className="text-center mb-12">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">Reservation Confirmed</span>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-4">Your Appointment is Confirmed</h1>
          <p className="text-muted-foreground font-light">We look forward to welcoming you, {appointment.clientName}.</p>
        </div>

        <div className="bg-card border border-border p-8 md:p-12 mb-8 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
          
          <div className="text-center border-b border-border pb-8 mb-8">
            <span className="uppercase tracking-widest text-[10px] text-muted-foreground block mb-2">Booking Reference</span>
            <span className="font-mono text-2xl tracking-[0.2em]">{appointment.bookingRef}</span>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm uppercase tracking-widest text-[10px]">Treatment</span>
              <span className="font-medium">{appointment.serviceName}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm uppercase tracking-widest text-[10px]">Date</span>
              <span className="font-medium">{format(new Date(appointment.date), "MMMM d, yyyy")}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm uppercase tracking-widest text-[10px]">Time</span>
              <span className="font-medium">{appointment.time}</span>
            </div>
            
            <div className="flex justify-between items-center pt-6 border-t border-border">
              <span className="text-muted-foreground text-sm uppercase tracking-widest text-[10px]">
                {paymentWasVerified ? "Amount Paid" : "Consultation Fee"}
              </span>
              <span className="font-serif text-xl">R{(appointment.totalAmountCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-12 text-sm text-muted-foreground/80 space-y-2">
          <p className="font-serif text-lg text-foreground">Sediba Aesthetic & Wellness Clinic</p>
          <p>Contact us at <a href="mailto:info@sedibawellnessclinic.co.za" className="text-primary hover:underline">info@sedibawellnessclinic.co.za</a></p>
          <p>Please arrive 5 minutes before your scheduled appointment.</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button 
            variant="outline" 
            onClick={handleCalendarDownload}
            className="rounded-none uppercase tracking-widest text-xs px-8 border-border"
          >
            Add to Calendar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const msg = `Hi Sediba, I just confirmed my appointment.\n\nRef: ${appointment.bookingRef}\nTreatment: ${appointment.serviceName}\nDate: ${format(new Date(appointment.date), "MMMM d, yyyy")}\nTime: ${appointment.time}\n\nPlease let me know if you need anything further.`;
              window.open(`https://wa.me/27814566402?text=${encodeURIComponent(msg)}`, "_blank");
            }}
            className="rounded-none uppercase tracking-widest text-xs px-8 border-border"
          >
            Message us on WhatsApp
          </Button>
          <Button 
            onClick={() => setLocation("/")}
            className="rounded-none uppercase tracking-widest text-xs px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}
