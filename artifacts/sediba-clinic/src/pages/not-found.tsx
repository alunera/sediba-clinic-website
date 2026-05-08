import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-background px-6 pt-32">
      <div className="text-center max-w-md animate-in fade-in zoom-in duration-500">
        <h1 className="font-serif text-8xl text-foreground mb-6">404</h1>
        <h2 className="font-serif text-2xl text-foreground mb-4">Page Not Found</h2>
        <p className="text-muted-foreground font-light mb-10 leading-relaxed">
          The page you are looking for does not exist or has been moved. Return to the homepage to continue your journey.
        </p>
        <Link href="/">
          <Button className="rounded-none bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs px-8 h-12">
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
