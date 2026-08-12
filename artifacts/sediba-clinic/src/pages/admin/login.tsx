import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const loginMutation = useAdminLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Password is required");
      return;
    }

    loginMutation.mutate(
      { data: { password } },
      {
        onSuccess: (data) => {
          if (data.authenticated) {
            setLocation("/admin/dashboard");
          } else {
            setError("Invalid credentials");
          }
        },
        onError: () => {
          setError("Invalid password");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border p-10">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl tracking-wide mb-2">SEDIBA</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2 block">
              Admin Password
            </Label>
            <Input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-none border-border h-12 focus-visible:ring-primary focus-visible:border-primary text-center tracking-widest"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-destructive text-sm text-center">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loginMutation.isPending}
            className="w-full rounded-none uppercase tracking-widest text-xs h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loginMutation.isPending ? "Authenticating..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
