import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { 
  useAdminListClients, 
  getAdminListClientsQueryKey 
} from "@workspace/api-client-react";

export default function AdminClients() {
  const { data: clients = [], isLoading } = useAdminListClients({
    query: { queryKey: getAdminListClientsQueryKey() }
  });

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => b.appointmentCount - a.appointmentCount);
  }, [clients]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-48 bg-muted mb-8" />
        <div className="h-96 bg-muted border border-border" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h1 className="font-serif text-3xl">Clients</h1>
        <p className="text-muted-foreground mt-1">Directory of all clinic patrons.</p>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-normal">Client Details</th>
                <th className="px-6 py-4 font-normal">Contact</th>
                <th className="px-6 py-4 font-normal">Total Visits</th>
                <th className="px-6 py-4 font-normal">Total Spent</th>
                <th className="px-6 py-4 font-normal">First Visit</th>
                <th className="px-6 py-4 font-normal">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No clients found.
                  </td>
                </tr>
              ) : (
                sortedClients.map((client, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{client.clientName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-muted-foreground">{client.clientEmail}</div>
                      <div className="text-muted-foreground text-xs">{client.clientPhone}</div>
                      {client.clientWhatsapp && (
                        <div className="text-green-600/70 text-xs">WA: {client.clientWhatsapp}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{client.appointmentCount}</span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      R{(client.totalSpentCents / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {client.firstVisit ? format(parseISO(client.firstVisit), "MMM d, yyyy") : '-'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {client.lastVisit ? format(parseISO(client.lastVisit), "MMM d, yyyy") : '-'}
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
