import { useEffect, useState, useRef } from "react";
import { 
  useAdminGetSettings, 
  getAdminGetSettingsQueryKey,
  useAdminUpdateSettings
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

  const updateSettings = useAdminUpdateSettings();

  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [workingHours, setWorkingHours] = useState("");

  const initializedRef = useRef(false);

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

  if (isLoading) {
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
    </div>
  );
}
