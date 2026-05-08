import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}

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

  const isOnHero = location === "/";
  const textColor = !isScrolled && isOnHero ? "text-white" : "text-foreground";
  const textMuted = !isScrolled && isOnHero ? "text-white/70" : "text-foreground/80";

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-white/90 backdrop-blur-md border-b border-border shadow-sm py-4" : "bg-transparent py-6"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link href="/">
          <div className="cursor-pointer">
            <h1 className={`font-serif text-2xl tracking-widest font-semibold uppercase transition-colors duration-300 ${textColor}`}>
              SEDIBA
            </h1>
            <p className={`text-[10px] tracking-[0.2em] uppercase mt-1 transition-colors duration-300 ${textMuted}`}>
              Aesthetic & Wellness
            </p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-10">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <span className={`text-sm uppercase tracking-wider transition-colors hover:text-primary cursor-pointer ${
                location === link.href ? "text-primary font-medium" : textMuted
              }`}>
                {link.name}
              </span>
            </Link>
          ))}

          <div className="flex items-center gap-3">
            <a
              href="https://www.instagram.com/sedibawellnessclinic?utm_source=qr&igsh=MTE4cXFoNjBzYmV5dw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors hover:text-primary ${textMuted}`}
              aria-label="Instagram"
            >
              <InstagramIcon size={16} />
            </a>
            <a
              href="https://www.facebook.com/sedibawellnessclinic"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors hover:text-primary ${textMuted}`}
              aria-label="Facebook"
            >
              <FacebookIcon size={16} />
            </a>
          </div>

          <Link href="/book">
            <Button variant="default" className="rounded-none px-8 tracking-wider uppercase text-xs">
              Book Consultation
            </Button>
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button
          className={`md:hidden transition-colors duration-300 ${textColor}`}
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
          <div className="flex items-center gap-4 pt-2">
            <a href="https://www.instagram.com/sedibawellnessclinic?utm_source=qr&igsh=MTE4cXFoNjBzYmV5dw%3D%3D" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Instagram">
              <InstagramIcon size={18} />
            </a>
            <a href="https://www.facebook.com/sedibawellnessclinic" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Facebook">
              <FacebookIcon size={18} />
            </a>
          </div>
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
