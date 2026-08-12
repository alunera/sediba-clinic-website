import { useMemo } from "react";
import { format, isToday, parseISO, isBefore, addDays } from "date-fns";
import { 
  useAdminListAppointments, 
  getAdminListAppointmentsQueryKey,
  useAdminListClients,
  getAdminListClientsQueryKey
} from "@workspace/api-client-react";
import { Users, Calendar as CalendarIcon, DollarSign, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { data: appointments = [], isLoading: loadingAppts } = useAdminListAppointments({
    query: { queryKey: getAdminListAppointmentsQueryKey() }
  });

  const { data: clients = [], isLoading: loadingClients } = useAdminListClients({
    query: { queryKey: getAdminListClientsQueryKey() }
  });

  const stats = useMemo(() => {
    const today = new Date();
    
    const todaysAppointments = appointments.filter(a => isToday(parseISO(a.date)));
    const todaysRevenue = todaysAppointments
      .filter(a => a.status === 'confirmed' || a.status === 'completed')
      .reduce((sum, a) => sum + a.totalAmountCents, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const newClientsThisWeek = clients.filter(c => 
      c.firstVisit && isBefore(sevenDaysAgo, parseISO(c.firstVisit))
    ).length;

    return {
      todayCount: todaysAppointments.length,
      todayRevenue: todaysRevenue,
      totalClients: clients.length,
      newClientsThisWeek
    };
  }, [appointments, clients]);

  const upcomingAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = addDays(today, 7);

    return appointments
      .filter(a => {
        const d = parseISO(a.date);
        return isBefore(today, d) && isBefore(d, nextWeek);
      })
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
  }, [appointments]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return "bg-primary/20 text-primary border-primary/30";
      case 'completed': return "bg-green-500/20 text-green-700 border-green-500/30";
      case 'cancelled': return "bg-destructive/20 text-destructive border-destructive/30";
      case 'no-show': return "bg-foreground/20 text-foreground border-foreground/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  if (loadingAppts || loadingClients) {
    return <div className="animate-pulse space-y-8">
      <div className="h-8 w-64 bg-muted mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted border border-border" />)}
      </div>
      <div className="h-96 bg-muted border border-border" />
    </div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in">
      <div>
        <h1 className="font-serif text-3xl">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your clinic's performance today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Today's Appointments</span>
            <CalendarIcon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-serif text-4xl">{stats.todayCount}</span>
        </div>

        <div className="bg-card border border-border p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Today's Revenue</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <span className="font-serif text-4xl">R{(stats.todayRevenue / 100).toFixed(2)}</span>
        </div>

        <div className="bg-card border border-border p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Total Clients</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <span className="font-serif text-4xl">{stats.totalClients}</span>
        </div>

        <div className="bg-card border border-border p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">New Clients (7d)</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <span className="font-serif text-4xl">{stats.newClientsThisWeek}</span>
        </div>
      </div>

      {/* Upcoming Table */}
      <div className="bg-card border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="font-serif text-xl">Upcoming Appointments</h2>
          <p className="text-sm text-muted-foreground mt-1">Next 7 days</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-normal">Date & Time</th>
                <th className="px-6 py-4 font-normal">Client</th>
                <th className="px-6 py-4 font-normal">Treatment</th>
                <th className="px-6 py-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {upcomingAppointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No upcoming appointments.
                  </td>
                </tr>
              ) : (
                upcomingAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{format(parseISO(appt.date), "MMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground">{appt.time}</div>
                    </td>
                    <td className="px-6 py-4">{appt.clientName}</td>
                    <td className="px-6 py-4">{appt.serviceName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] uppercase tracking-wider border ${getStatusColor(appt.status)}`}>
                        {appt.status}
                      </span>
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
