import { useEffect, useState, useRef } from "react";
import { 
  useAdminGetSettings, 
  getAdminGetSettingsQueryKey,
  useAdminUpdateSettings,
  useAdminGetConsultationService,
  getAdminGetConsultationServiceQueryKey,
  useAdminUpdateConsultationService,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useAdminGetSettings({
    query: { queryKey: getAdminGetSettingsQueryKey() }
  });

  const { data: consultation, isLoading: isConsultationLoading } = useAdminGetConsultationService({
    query: { queryKey: getAdminGetConsultationServiceQueryKey() }
  });

  const updateSettings = useAdminUpdateSettings();
  const updateConsultation = useAdminUpdateConsultationService();

  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [workingHours, setWorkingHours] = useState("");

  const [consultationDuration, setConsultationDuration] = useState("");
  const [consultationPrice, setConsultationPrice] = useState("");

  const initializedRef = useRef(false);
  const consultationInitializedRef = useRef(false);

  useEffect(() => {
    if (settings && !initializedRef.current) {
      setClinicName(settings.clinicName || "");
      setClinicAddress(settings.clinicAddress || "");
      setClinicPhone(settings.clinicPhone || "");
      setClinicEmail(settings.clinicEmail || "");
      setGoogleReviewUrl(settings.googleReviewUrl || "");
      setWorkingHours(settings.workingHours || "");
      initializedRef.current = true;
    }
  }, [settings]);

  useEffect(() => {
    if (consultation && !consultationInitializedRef.current) {
      setConsultationDuration(String(consultation.durationMinutes));
      setConsultationPrice(String(consultation.priceRands));
      consultationInitializedRef.current = true;
    }
  }, [consultation]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateSettings.mutate(
      {
        data: {
          clinicName: clinicName || null,
          clinicAddress: clinicAddress || null,
          clinicPhone: clinicPhone || null,
          clinicEmail: clinicEmail || null,
          googleReviewUrl: googleReviewUrl || null,
          workingHours: workingHours || null,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
          toast({
            title: "Settings Updated",
            description: "Clinic settings have been saved successfully.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update settings.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleConsultationSave = (e: React.FormEvent) => {
    e.preventDefault();

    const durationMinutes = parseInt(consultationDuration, 10);
    const priceRands = parseFloat(consultationPrice);

    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      toast({ title: "Invalid duration", description: "Duration must be at least 1 minute.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(priceRands) || priceRands < 0) {
      toast({ title: "Invalid price", description: "Price must be a non-negative number.", variant: "destructive" });
      return;
    }

    updateConsultation.mutate(
      { data: { durationMinutes, priceRands } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminGetConsultationServiceQueryKey() });
          toast({
            title: "Consultation Updated",
            description: "Consultation price and duration have been saved.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update consultation settings.",
            variant: "destructive"
          });
        }
      }
    );
  };

  if (isLoading || isConsultationLoading) {
    return (
      <div className="animate-pulse space-y-6 max-w-2xl">
        <div className="h-10 w-48 bg-muted mb-8" />
        <div className="h-12 bg-muted border border-border w-full" />
        <div className="h-12 bg-muted border border-border w-full" />
        <div className="h-12 bg-muted border border-border w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your clinic details and preferences.</p>
      </div>

      <form onSubmit={handleSave} className="bg-card border border-border p-8 space-y-8">
        
        <div className="space-y-6">
          <h2 className="font-serif text-xl border-b border-border pb-4">General Information</h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Clinic Name</Label>
              <Input 
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
              />
            </div>
            
            <div>
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Physical Address</Label>
              <Input 
                value={clinicAddress}
                onChange={e => setClinicAddress(e.target.value)}
                className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Contact Phone</Label>
                <Input 
                  value={clinicPhone}
                  onChange={e => setClinicPhone(e.target.value)}
                  className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
                />
              </div>
              
              <div>
                <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Contact Email</Label>
                <Input 
                  type="email"
                  value={clinicEmail}
                  onChange={e => setClinicEmail(e.target.value)}
                  className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-4 border-t border-border">
          <h2 className="font-serif text-xl border-b border-border pb-4">Integrations</h2>
          
          <div>
            <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">Google Review URL</Label>
            <Input 
              type="url"
              value={googleReviewUrl}
              onChange={e => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/..."
              className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
            />
            <p className="text-xs text-muted-foreground mt-2">This link will be sent to clients after completed appointments.</p>
          </div>
        </div>

        <div className="pt-8 flex justify-end">
          <Button 
            type="submit"
            disabled={updateSettings.isPending}
            className="rounded-none uppercase tracking-widest text-xs px-10 h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {updateSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>

      {/* Consultation section — separate form so it saves independently */}
      <form onSubmit={handleConsultationSave} className="bg-card border border-border p-8 space-y-8">
        <div className="space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="font-serif text-xl">Consultation</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Price and duration applied to all new consultation bookings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                Duration (minutes)
              </Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={consultationDuration}
                onChange={e => setConsultationDuration(e.target.value)}
                className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
              />
            </div>

            <div>
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
                Price (R)
              </Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={consultationPrice}
                onChange={e => setConsultationPrice(e.target.value)}
                className="rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button
            type="submit"
            disabled={updateConsultation.isPending}
            className="rounded-none uppercase tracking-widest text-xs px-10 h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {updateConsultation.isPending ? "Saving..." : "Save Consultation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
