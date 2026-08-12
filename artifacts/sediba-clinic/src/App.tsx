import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FloatingChat } from "@/components/FloatingChat";
import NotFound from "@/pages/not-found";

// Pages
import Home from "@/pages/home";
import Services from "@/pages/services";
import Book from "@/pages/book";
import AiAssistant from "@/pages/ai-assistant";
import About from "@/pages/about";
import BookingConfirmation from "@/pages/booking-confirmation";

// Admin Pages
import { AdminLayout } from "@/components/layout/admin-layout";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminCalendar from "@/pages/admin/calendar";
import AdminAppointments from "@/pages/admin/appointments";
import AdminClients from "@/pages/admin/clients";
import AdminSettings from "@/pages/admin/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Admin routes without public layout */}
      <Route path="/admin/login" component={AdminLogin} />
      
      {/* Admin routes with AdminLayout */}
      <Route path="/admin" component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />
      <Route path="/admin/dashboard" component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />
      <Route path="/admin/calendar" component={() => <AdminLayout><AdminCalendar /></AdminLayout>} />
      <Route path="/admin/appointments" component={() => <AdminLayout><AdminAppointments /></AdminLayout>} />
      <Route path="/admin/clients" component={() => <AdminLayout><AdminClients /></AdminLayout>} />
      <Route path="/admin/settings" component={() => <AdminLayout><AdminSettings /></AdminLayout>} />

      {/* Public routes */}
      <Route>
        <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/30">
          <Navbar />
          <main className="flex-grow">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/services" component={Services} />
              <Route path="/book" component={Book} />
              <Route path="/booking-confirmation" component={BookingConfirmation} />
              <Route path="/ai-assistant" component={AiAssistant} />
              <Route path="/about" component={About} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
          <FloatingChat />
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
