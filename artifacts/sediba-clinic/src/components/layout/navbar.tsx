import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Services", href: "/services" },
    { name: "About", href: "/about" },
    { name: "AI Assistant", href: "/ai-assistant" },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-white/90 backdrop-blur-md border-b border-border shadow-sm py-4" : "bg-transparent py-6"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link href="/">
          <div className="cursor-pointer">
            <h1 className="font-serif text-2xl tracking-widest text-foreground font-semibold uppercase">
              SEDIBA
            </h1>
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-1">
              Aesthetic & Wellness
            </p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-12">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <span className={`text-sm uppercase tracking-wider transition-colors hover:text-primary cursor-pointer ${
                location === link.href ? "text-primary font-medium" : "text-foreground/80"
              }`}>
                {link.name}
              </span>
            </Link>
          ))}
          <Link href="/book">
            <Button variant="default" className="rounded-none px-8 tracking-wider uppercase text-xs">
              Book Consultation
            </Button>
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-border shadow-lg py-6 px-6 flex flex-col space-y-6">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <span 
                className="text-sm uppercase tracking-wider text-foreground block cursor-pointer"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </span>
            </Link>
          ))}
          <Link href="/book">
            <Button 
              variant="default" 
              className="rounded-none w-full tracking-wider uppercase text-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Book Consultation
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
