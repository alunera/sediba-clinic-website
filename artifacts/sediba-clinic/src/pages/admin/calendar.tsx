import { useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { 
  useAdminListAppointments, 
  getAdminListAppointmentsQueryKey,
  useAdminUpdateAppointment,
  Appointment
} from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminCalendar() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const { data: appointments = [] } = useAdminListAppointments({
    query: { queryKey: getAdminListAppointmentsQueryKey() }
  });

  const updateAppointment = useAdminUpdateAppointment();

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  // Calculate padding days to start on correct weekday (Sunday = 0)
  const startDay = startOfMonth(currentMonth).getDay();
  const paddingDays = Array.from({ length: startDay }).map((_, i) => i);

  const handleUpdateStatus = (id: number, status: any) => {
    updateAppointment.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListAppointmentsQueryKey() });
          setSelectedAppointment(null);
        }
      }
    );
  };

  const dayAppointments = selectedDate 
    ? appointments.filter(a => isSameDay(parseISO(a.date), selectedDate)).sort((a,b) => a.time.localeCompare(b.time))
    : [];

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return "bg-primary";
      case 'completed': return "bg-green-500";
      case 'cancelled': return "bg-destructive";
      case 'no-show': return "bg-foreground";
      default: return "bg-muted";
    }
  };

  const isConsultation = (appt: Appointment) => appt.appointmentType === 'consultation';

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-6 animate-in fade-in">
      
      {/* Calendar Grid */}
      <div className="flex-1 bg-card border border-border p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 border border-border hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border mb-px">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-card py-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border flex-1">
          {paddingDays.map(i => (
            <div key={`pad-${i}`} className="bg-card/50 min-h-[100px]" />
          ))}
          {days.map(day => {
            const dayAppts = appointments.filter(a => isSameDay(parseISO(a.date), day));
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            return (
              <div 
                key={day.toISOString()} 
                onClick={() => setSelectedDate(day)}
                className={`bg-card min-h-[100px] p-2 cursor-pointer transition-colors relative hover:bg-muted/50 ${isSelected ? "ring-2 ring-primary ring-inset z-10" : ""}`}
              >
                <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </span>
                
                <div className="mt-2 space-y-1">
                  {dayAppts.slice(0, 3).map(appt => (
                    <div key={appt.id} className={`flex items-center gap-1.5 text-xs truncate px-1 rounded-sm ${isConsultation(appt) ? "bg-amber-500/15" : "bg-muted/50"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConsultation(appt) ? "bg-amber-500" : getStatusColor(appt.status)}`} />
                      <span className="truncate">{appt.time} {appt.clientName}</span>
                      {isConsultation(appt) && <span className="flex-shrink-0 text-[8px] uppercase tracking-wider font-semibold text-amber-600">C</span>}
                    </div>
                  ))}
                  {dayAppts.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayAppts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-full md:w-80 bg-card border border-border flex flex-col flex-shrink-0 h-full">
        {selectedAppointment ? (
          <div className="p-6 h-full flex flex-col">
            <button 
              onClick={() => setSelectedAppointment(null)}
              className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest mb-6 hover:text-foreground"
            >
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-serif text-xl">Appointment Details</h3>
              {isConsultation(selectedAppointment) && (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 bg-amber-500/15 px-2 py-1 rounded-sm border border-amber-400/30">Consultation</span>
              )}
            </div>
            
            <div className="space-y-4 text-sm flex-1">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Client</span>
                <p className="font-medium">{selectedAppointment.clientName}</p>
                <p className="text-muted-foreground">{selectedAppointment.clientEmail}</p>
                <p className="text-muted-foreground">{selectedAppointment.clientPhone}</p>
              </div>
              
              <div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                  {isConsultation(selectedAppointment) ? "Consultation Service" : "Treatment"}
                </span>
                <p>{selectedAppointment.serviceName}</p>
              </div>

              {isConsultation(selectedAppointment) && selectedAppointment.notes && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Concern / Notes</span>
                  <p className="text-sm bg-amber-500/5 border border-amber-400/20 px-3 py-2 leading-relaxed">{selectedAppointment.notes}</p>
                </div>
              )}
              
              <div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Date & Time</span>
                <p>{format(parseISO(selectedAppointment.date), "MMMM d, yyyy")} at {selectedAppointment.time}</p>
              </div>
              
              <div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Status</span>
                <p className="capitalize">{selectedAppointment.status}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-border mt-auto">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-3">Update Status</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleUpdateStatus(selectedAppointment.id, 'confirmed')} className="py-2 text-xs border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">Confirm</button>
                <button onClick={() => handleUpdateStatus(selectedAppointment.id, 'completed')} className="py-2 text-xs border border-border hover:bg-green-600 hover:text-white hover:border-green-600 transition-colors">Complete</button>
                <button onClick={() => handleUpdateStatus(selectedAppointment.id, 'no-show')} className="py-2 text-xs border border-border hover:bg-foreground hover:text-background hover:border-foreground transition-colors">No Show</button>
                <button onClick={() => handleUpdateStatus(selectedAppointment.id, 'cancelled')} className="py-2 text-xs border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 h-full flex flex-col">
            <h3 className="font-serif text-xl mb-2">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Select a date"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">{dayAppointments.length} Appointments</p>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {dayAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No appointments for this day.</p>
              ) : (
                dayAppointments.map(appt => (
                  <div 
                    key={appt.id}
                    onClick={() => setSelectedAppointment(appt)}
                    className={`p-3 border cursor-pointer transition-colors hover:border-primary ${isConsultation(appt) ? "border-amber-400/50 bg-amber-500/5" : "border-border"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{appt.time}</span>
                      <div className="flex items-center gap-1.5">
                        {isConsultation(appt) && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-600 bg-amber-500/15 px-1.5 py-0.5 rounded-sm">Consult</span>
                        )}
                        <div className={`w-2 h-2 rounded-full ${isConsultation(appt) ? "bg-amber-500" : getStatusColor(appt.status)}`} />
                      </div>
                    </div>
                    <p className="text-sm font-medium">{appt.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{appt.serviceName}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
