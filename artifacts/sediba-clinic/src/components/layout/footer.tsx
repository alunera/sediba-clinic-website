import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-foreground text-white pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <h2 className="font-serif text-3xl tracking-widest uppercase mb-4">SEDIBA</h2>
            <p className="text-white/60 text-sm max-w-sm leading-relaxed mb-8">
              Where high-end aesthetic medicine meets holistic wellness. A private sanctuary for the discerning individual.
            </p>
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
              <li>14 Wellness Boulevard</li>
              <li>Sandton, 2196</li>
              <li>South Africa</li>
              <li className="pt-4">
                <a href="mailto:concierge@sedibaclinic.co.za" className="hover:text-primary transition-colors">
                  concierge@sedibaclinic.co.za
                </a>
              </li>
              <li>+27 11 555 0199</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-white/40 text-xs tracking-wider uppercase">
          <p>&copy; {new Date().getFullYear()} Sediba Aesthetic & Wellness Clinic.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
