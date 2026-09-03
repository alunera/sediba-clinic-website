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

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/>
    </svg>
  );
}

export function Navbar() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Services", href: "/services" },
    { name: "About", href: "/about" },
    { name: "Staff Login", href: "/admin/login" },
  ];

  const isOnHero = location === "/";
  const logoInvert = !isScrolled && isOnHero;

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-white/90 backdrop-blur-md border-b border-border shadow-sm py-3" : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <div className="cursor-pointer">
            <img
              src="/logo.png"
              alt="Sediba Aesthetic & Wellness Clinic"
              className={`h-12 w-auto object-contain transition-all duration-300 ${logoInvert ? "brightness-0 invert" : "brightness-0"}`}
            />
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-8">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <span className={`text-sm uppercase tracking-wider transition-colors hover:text-primary cursor-pointer ${
                location === link.href
                  ? "text-primary font-medium"
                  : logoInvert ? "text-white/80" : "text-foreground/80"
              }`}>
                {link.name}
              </span>
            </Link>
          ))}

          <div className="hidden lg:flex items-center gap-3">
            <a
              href="https://www.instagram.com/sedibawellnessclinic?utm_source=qr&igsh=MTE4cXFoNjBzYmV5dw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors hover:text-primary ${logoInvert ? "text-white/70" : "text-foreground/60"}`}
              aria-label="Instagram"
            >
              <InstagramIcon size={16} />
            </a>
            <a
              href="https://www.facebook.com/share/17iZSPotiF/"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors hover:text-primary ${logoInvert ? "text-white/70" : "text-foreground/60"}`}
              aria-label="Facebook"
            >
              <FacebookIcon size={16} />
            </a>
            <a
              href="https://www.tiktok.com/@sedibawellnessclinic?_r=1&_t=ZS-96Bti2ATdMg"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors hover:text-primary ${logoInvert ? "text-white/70" : "text-foreground/60"}`}
              aria-label="TikTok"
            >
              <TikTokIcon size={16} />
            </a>
          </div>

          <Link href="/book-consultation">
            <Button variant="default" className="rounded-none px-5 lg:px-8 tracking-wider uppercase text-xs">
              Book Consultation
            </Button>
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button
          className={`md:hidden transition-colors duration-300 p-2 -mr-2 ${logoInvert ? "text-white" : "text-foreground"}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-border shadow-lg py-4 px-6 flex flex-col space-y-2">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <span
                className="text-sm uppercase tracking-wider text-foreground block cursor-pointer py-3"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </span>
            </Link>
          ))}
          <div className="flex items-center gap-6 pt-4 pb-2">
            <a href="https://www.instagram.com/sedibawellnessclinic?utm_source=qr&igsh=MTE4cXFoNjBzYmV5dw%3D%3D" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-2 -ml-2" aria-label="Instagram">
              <InstagramIcon size={20} />
            </a>
            <a href="https://www.facebook.com/share/17iZSPotiF/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-2" aria-label="Facebook">
              <FacebookIcon size={20} />
            </a>
            <a href="https://www.tiktok.com/@sedibawellnessclinic?_r=1&_t=ZS-96Bti2ATdMg" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-2" aria-label="TikTok">
              <TikTokIcon size={20} />
            </a>
          </div>
          <Link href="/book-consultation" onClick={() => setIsMobileMenuOpen(false)} className="block pt-2">
            <Button
              variant="default"
              className="rounded-none w-full tracking-wider uppercase text-xs py-6"
            >
              Book Consultation
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
