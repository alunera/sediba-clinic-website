import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { 
  useListServices, 
  getListServicesQueryKey,
  useGetAvailability,
  useCreateAppointment
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Book() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // URL params
  const searchParams = new URLSearchParams(window.location.search);
  const defaultServiceId = searchParams.get("service") ? parseInt(searchParams.get("service")!) : null;

  // Form State
  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(defaultServiceId);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: services, isLoading: isLoadingServices } = useListServices({
    query: { queryKey: getListServicesQueryKey() }
  });

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const { data: availability, isLoading: isLoadingAvailability } = useGetAvailability(
    { date: dateStr, serviceId: selectedServiceId || undefined },
    { query: { enabled: !!selectedDate && !!selectedServiceId } }
  );

  const createAppointment = useCreateAppointment();

  const handleBook = () => {
    if (!selectedServiceId || !selectedDate || !selectedTime || !clientName || !clientEmail || !clientPhone) {
      toast({ title: "Incomplete details", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    createAppointment.mutate({
      data: {
        serviceId: selectedServiceId,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedTime,
        clientName,
        clientEmail,
        clientPhone,
        notes: notes || undefined,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Reservation Confirmed",
          description: "Your appointment has been successfully booked.",
        });
        setLocation("/");
      },
      onError: (err) => {
        toast({
          title: "Booking Failed",
          description: "There was an error securing your reservation. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen pt-32 pb-24 bg-background flex flex-col items-center">
      <div className="container max-w-3xl px-6">
        <div className="text-center mb-16">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">Reservations</span>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-6">Secure Your Time</h1>
          <p className="text-muted-foreground font-light max-w-xl mx-auto">
            Select your preferred treatment and time. Our concierge will prepare the clinic for your arrival.
          </p>
        </div>

        <div className="bg-card border border-border p-8 md:p-12">
          {/* Step Indicators */}
          <div className="flex justify-between border-b border-border pb-8 mb-8">
            {["Treatment", "Time", "Details"].map((label, idx) => (
              <div 
                key={label} 
                className={`flex flex-col items-center flex-1 ${step === idx + 1 ? "text-primary" : step > idx + 1 ? "text-foreground" : "text-muted-foreground/50"}`}
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
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse border border-border" />)}
                </div>
              ) : (
                <div className="grid gap-4">
                  {services?.map(service => (
                    <div 
                      key={service.id}
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`cursor-pointer p-6 border transition-all duration-300 flex justify-between items-center ${
                        selectedServiceId === service.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <div>
                        <h3 className="font-serif text-lg text-foreground mb-1">{service.name}</h3>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          {service.duration} Min &bull; R{service.price}
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedServiceId === service.id ? "border-primary" : "border-border"
                      }`}>
                        {selectedServiceId === service.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!selectedServiceId}
                  className="rounded-none uppercase tracking-widest text-xs px-8"
                >
                  Continue
                </Button>
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
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setSelectedTime(null);
                      }}
                      disabled={(date) => date < new Date() || date.getDay() === 0} // Disable past dates and Sundays
                      className="font-sans"
                    />
                  </div>
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
                  <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Notes (Optional)</Label>
                  <Textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary min-h-[100px]"
                    placeholder="Any specific concerns or requests?"
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-6 mt-8 border border-border">
                <h4 className="font-serif text-lg mb-4">Reservation Summary</h4>
                <div className="space-y-2 text-sm text-foreground/80">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Treatment:</span>
                    <span className="font-medium text-foreground">{services?.find(s => s.id === selectedServiceId)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium text-foreground">{selectedDate && format(selectedDate, "MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium text-foreground">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border mt-2">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium text-foreground">R{services?.find(s => s.id === selectedServiceId)?.price}</span>
                  </div>
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
                  onClick={handleBook} 
                  disabled={!clientName || !clientEmail || !clientPhone || createAppointment.isPending}
                  className="rounded-none uppercase tracking-widest text-xs px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {createAppointment.isPending ? "Confirming..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
