import { useLocation } from "wouter";
import { format } from "date-fns";
import { 
  useGetAppointmentByRef, 
  getGetAppointmentByRefQueryKey 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

export default function BookingConfirmation() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const ref = searchParams.get("ref");

  const { data: appointment, isLoading, isError } = useGetAppointmentByRef(ref || "", {
    query: {
      enabled: !!ref,
      queryKey: getGetAppointmentByRefQueryKey(ref || "")
    }
  });

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

  const handleCalendarDownload = () => {
    // Generate a basic .ics file content
    const dateStr = appointment.date.replace(/-/g, "");
    const timeStr = appointment.time.replace(":", "") + "00";
    // This is a naive implementation; real world needs timezone handling
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
              <span className="text-muted-foreground text-sm uppercase tracking-widest text-[10px]">Total Amount</span>
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
