import { useState } from "react";
import { useAdminGetSettings, getAdminGetSettingsQueryKey, type AdminAppointment } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { manualMessage, safeReviewUrl, whatsappNumber, type MessageKind } from "@/lib/manual-whatsapp";

const labels: Record<MessageKind,string> = { confirmation:"Send confirmation", reminder:"Send reminder", review:"Request Google review" };
export function ManualWhatsApp({ appointment: appt }: { appointment: AdminAppointment }) {
  const [open,setOpen] = useState(false);
  const [kind,setKind] = useState<MessageKind>("confirmation");
  const [number,setNumber] = useState("");
  const [message,setMessage] = useState<string | null>(null);
  const settings = useAdminGetSettings({query:{queryKey:getAdminGetSettingsQueryKey(),enabled:open,staleTime:0,refetchOnWindowFocus:true}});
  const review = safeReviewUrl(settings.data?.googleReviewUrl ?? "");
  const recipient = whatsappNumber(number);
  // Compare actual instants, not strings with different time-zone offsets.
  const future = new Date(`${appt.date}T${appt.time.slice(0,5)}:00+02:00`).getTime() > Date.now();
  const eligible = kind === "review" ? appt.status === "completed" : appt.status === "confirmed" && future;
  const ready = !!settings.data && !settings.isError && !settings.isFetching && eligible && (kind !== "review" || !!review);
  const text = message ?? (settings.data ? manualMessage(kind,appt,settings.data.clinicName || "Sediba Aesthetic & Wellness Clinic",review ?? "") : "");
  return <>
    <button type="button" className="h-8 px-3 text-[10px] uppercase tracking-widest border border-border hover:bg-muted" onClick={()=>{
      setNumber(appt.clientWhatsapp || appt.clientPhone || "");
      setKind(appt.status === "completed" ? "review" : "confirmation");
      setMessage(null);setOpen(true);
    }} data-testid={`button-whatsapp-${appt.id}`}>WhatsApp</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manual WhatsApp message</DialogTitle><DialogDescription>Review the recipient and message. WhatsApp opens on your device; you must press Send there. Nothing is sent automatically or marked as delivered.</DialogDescription></DialogHeader>
        <p className="text-xs text-muted-foreground">Use the clinic’s WhatsApp Business account, not your personal account. Only contact clients who have agreed to receive these messages. Treatment details are omitted for privacy.</p>
        <label className="text-sm">Message type<select className="block w-full border p-2 bg-background mt-1" value={kind} onChange={e=>{setKind(e.target.value as MessageKind);setMessage(null);}}>
          {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        {!eligible && <p role="alert" className="text-sm text-destructive">{kind === "review" ? "Review requests are available for completed appointments only." : "Confirmations and reminders are available for confirmed, upcoming appointments only."}</p>}
        {settings.isFetching && <p role="status">Loading clinic settings…</p>}
        {settings.isError && <div role="alert">Could not load settings. <button className="underline" onClick={()=>settings.refetch()}>Try again</button></div>}
        {settings.data && kind === "review" && !review && <p role="alert" className="text-sm text-destructive">Save a valid HTTPS Google Review URL in Admin Settings first.</p>}
        <label className="text-sm">Client WhatsApp number<input className="block w-full border p-2 bg-background mt-1" value={number} onChange={e=>setNumber(e.target.value)} placeholder="082 123 4567 or +27…" type="tel" /></label>
        {!recipient && <p className="text-xs text-destructive">Enter a valid WhatsApp number, including the country code for numbers outside South Africa.</p>}
        <label className="text-sm">Prepared message<textarea className="block w-full border p-2 bg-background mt-1" rows={8} value={text} onChange={e=>setMessage(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Opening WhatsApp does not confirm the number has a WhatsApp account or that a message was sent.</p>
        {ready && recipient && text.trim() ? <a href={`https://wa.me/${recipient}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="bg-primary text-primary-foreground text-center p-3">Open WhatsApp to send</a> : <button disabled className="bg-muted text-muted-foreground p-3">Open WhatsApp to send</button>}
      </DialogContent>
    </Dialog>
  </>;
}
