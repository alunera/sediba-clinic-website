import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { 
  useAdminListAppointments, 
  getAdminListAppointmentsQueryKey,
  useAdminUpdateAppointment
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusTab = 'all' | 'pending' | 'pending_payment' | 'payment_failed' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

export default function AdminAppointments() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  
  const { data: appointments = [], isLoading } = useAdminListAppointments({
    query: { queryKey: getAdminListAppointmentsQueryKey() }
  });

  const updateAppointment = useAdminUpdateAppointment();

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    if (activeTab !== 'all') {
      filtered = filtered.filter(a => a.status === activeTab);
    }
    // Sort descending by date and time
    return filtered.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });
  }, [appointments, activeTab]);

  const handleUpdateStatus = (id: number, status: string) => {
    updateAppointment.mutate(
      { id, data: { status: status as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListAppointmentsQueryKey() });
        }
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return "bg-muted text-muted-foreground border-border";
      case 'pending_payment': return "bg-amber-500/20 text-amber-700 border-amber-500/30";
      case 'payment_failed': return "bg-destructive/20 text-destructive border-destructive/30";
      case 'confirmed': return "bg-primary/20 text-primary border-primary/30";
      case 'completed': return "bg-green-500/20 text-green-700 border-green-500/30";
      case 'cancelled': return "bg-destructive/20 text-destructive border-destructive/30";
      case 'no-show': return "bg-foreground/20 text-foreground border-foreground/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const paymentStatusStyles = {
    paid: {
      label: "Paid",
      className: "bg-green-500/20 text-green-700 border-green-500/30",
    },
    pending: {
      label: "Pending",
      className: "bg-amber-500/20 text-amber-700 border-amber-500/30",
    },
    failed: {
      label: "Failed",
      className: "bg-destructive/20 text-destructive border-destructive/30",
    },
    unpaid: {
      label: "Unpaid",
      className: "bg-muted text-muted-foreground border-border",
    },
  } as const;

  const tabs: {id: StatusTab, label: string}[] = [
    { id: 'all', label: 'All' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'completed', label: 'Completed' },
    { id: 'pending', label: 'Pending' },
    { id: 'pending_payment', label: 'Awaiting Payment' },
    { id: 'payment_failed', label: 'Payment Failed' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'no-show', label: 'No-Show' }
  ];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-48 bg-muted mb-8" />
        <div className="h-12 bg-muted border border-border" />
        <div className="h-96 bg-muted border border-border" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h1 className="font-serif text-3xl">Appointments</h1>
        <p className="text-muted-foreground mt-1">Manage all clinic bookings.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors border ${
              activeTab === tab.id 
                ? "bg-foreground text-background border-foreground" 
                : "bg-transparent text-foreground border-transparent hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-normal">Ref</th>
                <th className="px-6 py-4 font-normal">Client</th>
                <th className="px-6 py-4 font-normal">Type</th>
                <th className="px-6 py-4 font-normal">Service</th>
                <th className="px-6 py-4 font-normal">Date & Time</th>
                <th className="px-6 py-4 font-normal">Amount</th>
                <th className="px-6 py-4 font-normal">Payment</th>
                <th className="px-6 py-4 font-normal">Booking Status</th>
                <th className="px-6 py-4 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    No appointments found for this filter.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">{appt.bookingRef}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{appt.clientName}</div>
                      <div className="text-xs text-muted-foreground">{appt.clientPhone}</div>
                    </td>
                    <td className="px-6 py-4">
                      {appt.appointmentType === 'consultation' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] uppercase tracking-wider border bg-amber-500/15 text-amber-700 border-amber-400/30">Consultation</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] uppercase tracking-wider border bg-primary/10 text-primary border-primary/20">Treatment</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{appt.serviceName}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{format(parseISO(appt.date), "MMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground">{appt.time}</div>
                    </td>
                    <td className="px-6 py-4">R{(appt.totalAmountCents / 100).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] uppercase tracking-wider border ${paymentStatusStyles[appt.paymentStatus].className}`}>
                        {paymentStatusStyles[appt.paymentStatus].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] uppercase tracking-wider border ${getStatusColor(appt.status)}`}>
                        {appt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Select 
                        value={appt.status} 
                        onValueChange={(val) => handleUpdateStatus(appt.id, val)}
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs rounded-none border-border">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border-border">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="pending_payment">Awaiting Payment</SelectItem>
                          <SelectItem value="payment_failed">Payment Failed</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no-show">No-Show</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
