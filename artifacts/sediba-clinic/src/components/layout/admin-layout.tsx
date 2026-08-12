import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, Settings, LogOut, FileText } from "lucide-react";
import { useAdminLogout } from "@workspace/api-client-react";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const logout = useAdminLogout();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        if (!res.ok) {
          throw new Error("Not authenticated");
        }
        setIsCheckingAuth(false);
      } catch (err) {
        setLocation("/admin/login");
      }
    };
    checkAuth();
  }, [location, setLocation]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        setLocation("/admin/login");
      }
    });
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Calendar", path: "/admin/calendar", icon: Calendar },
    { name: "Appointments", path: "/admin/appointments", icon: FileText },
    { name: "Clients", path: "/admin/clients", icon: Users },
    { name: "Settings", path: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-border">
          <Link href="/admin/dashboard" className="block text-center">
            <h1 className="font-serif text-xl tracking-wide">SEDIBA</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Admin Portal</p>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || location.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
