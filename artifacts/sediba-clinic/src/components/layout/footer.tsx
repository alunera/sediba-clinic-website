import { Link } from "wouter";

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}

function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/>
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-foreground text-white pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <h2 className="font-serif text-3xl tracking-widest uppercase mb-4">SEDIBA</h2>
            <p className="text-white/60 text-sm max-w-sm leading-relaxed mb-6">
              A sanctuary for the senses — where we bring together a blend of classic clinical treatments, trusted advice, and spa tranquility; all wrapped up in modern luxury.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/sedibawellnessclinic?utm_source=qr&igsh=MTE4cXFoNjBzYmV5dw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <InstagramIcon size={20} />
              </a>
              <a
                href="https://www.facebook.com/sedibawellnessclinic"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-primary transition-colors"
                aria-label="Facebook"
              >
                <FacebookIcon size={20} />
              </a>
              <a
                href="https://www.tiktok.com/@sedibawellnessclinic?_r=1&_t=ZS-96Bti2ATdMg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-primary transition-colors"
                aria-label="TikTok"
              >
                <TikTokIcon size={20} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-serif text-lg tracking-widest uppercase mb-6 text-primary">Explore</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/services">
                  <span className="text-white/80 hover:text-primary transition-colors text-sm uppercase tracking-wider cursor-pointer">Treatments</span>
                </Link>
              </li>
              <li>
                <Link href="/about">
                  <span className="text-white/80 hover:text-primary transition-colors text-sm uppercase tracking-wider cursor-pointer">Clinic Story</span>
                </Link>
              </li>
              <li>
                <Link href="/ai-assistant">
                  <span className="text-white/80 hover:text-primary transition-colors text-sm uppercase tracking-wider cursor-pointer">Sedi Assistant</span>
                </Link>
              </li>
              <li>
                <Link href="/book">
                  <span className="text-white/80 hover:text-primary transition-colors text-sm uppercase tracking-wider cursor-pointer">Book Visit</span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-lg tracking-widest uppercase mb-6 text-primary">Contact</h3>
            <ul className="space-y-4 text-white/80 text-sm">
              <li>Hertford Office Park</li>
              <li>90 Bekker Road, Vorna Valley</li>
              <li>Midrand, South Africa</li>
              <li className="pt-4">
                <a href="mailto:info@sedibawellnessclinic.co.za" className="hover:text-primary transition-colors">
                  info@sedibawellnessclinic.co.za
                </a>
              </li>
              <li>
                <a href="tel:+27814566402" className="hover:text-primary transition-colors">
                  081 456 6402
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-white/40 text-xs tracking-wider uppercase">
          <p>&copy; {new Date().getFullYear()} Sediba Aesthetic & Wellness Clinic. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
