import { motion } from "framer-motion";

/* ─── Treatment data from the official treatment menu ─────────────────────── */

const SKIN = [
  { name: "The Glow",    sub: "Radiance · Hydration · Refresh",              price: "From R1,000" },
  { name: "The Clarify", sub: "Congestion · Breakouts · Balance",            price: "From R1,000" },
  { name: "The Brighten",sub: "Pigmentation · Tone · Luminosity",            price: "From R1,000" },
  { name: "The Firm",    sub: "Fine Lines · Firmness · Collagen",            price: "From R1,000" },
  { name: "The Calm",    sub: "Sensitivity · Redness · Barrier Support",     price: "From R1,000" },
  { name: "The Renew",   sub: "Resurfacing · Texture · Skin Renewal",        price: "From R1,000" },
  { name: "The Lift",    sub: "Firming · Definition · Rejuvenation",         price: "From R1,000" },
  { name: "The Repair",  sub: "Regeneration · Recovery · Skin Restoration",  price: "From R1,000" },
];

const ADVANCED = [
  { name: "The Precision Peel",        sub: "Targeted Resurfacing · Pigmentation · Texture", price: "From R1,250" },
  { name: "The Collagen Boost",        sub: "Microneedling · Texture · Fine Lines",           price: "From R990"   },
  { name: "The Regeneration (Exosome)",sub: "Exosome Therapy · Repair · Rejuvenation",        price: "From R2,500" },
  { name: "The Perfect Polish",        sub: "Dermaplaning · Smoothness · Radiance",           price: "From R850"   },
  { name: "The Light Therapy",         sub: "LED · Calm · Repair",                            price: "R1,750"      },
  { name: "The Smooth",                sub: "Laser Hair Removal · All Skin Types",            price: "From R450"   },
  { name: "The Clear",                 sub: "Laser Tattoo Removal",                           price: "From R450"   },
  { name: "The Contour",               sub: "Cavitation · Body Contouring",                   price: "From R550"   },
];

const BODY = [
  { name: "The Sediba Signature", sub: "Full-Body Relaxation · Restore · Rebalance",     price: "R750" },
  { name: "The Deep Release",     sub: "Deep Tissue · Muscle Tension · Recovery",        price: "R500" },
  { name: "The Reset",            sub: "Back · Neck · Shoulders",                        price: "R450" },
  { name: "The Aroma Ritual",     sub: "Aromatherapy · Relaxation · Wellbeing",          price: "R800" },
  { name: "Add-On Massage",       sub: "Hand or Foot Massage (Add-On)",                  price: "R350" },
];

const HANDS_FEET = [
  { name: "The Manicure",           sub: "Shape · Cuticle Care · Polish",   price: "R350" },
  { name: "The Gel Manicure",       sub: "Long-Wear · High Shine",          price: "R400" },
  { name: "The Pedicure",           sub: "Foot Care · Shape · Polish",      price: "R420" },
  { name: "The Gel Pedicure",       sub: "Long-Wear · High Shine",          price: "R620" },
  { name: "The Luxury Hand Ritual", sub: "Exfoliate · Nourish · Massage",   price: "R350" },
  { name: "The Luxury Foot Ritual", sub: "Exfoliate · Restore · Massage",   price: "R350" },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-6 mb-10">
      <h2 className="font-serif text-3xl md:text-4xl text-foreground whitespace-nowrap">{label}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function TreatmentRow({ name, sub, price, idx }: { name: string; sub: string; price: string; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: idx * 0.05 }}
      className="flex items-baseline justify-between gap-6 py-4 border-b border-border last:border-b-0 group"
    >
      <div className="flex-1 min-w-0">
        <span className="font-serif text-base md:text-lg text-foreground group-hover:text-primary transition-colors">
          {name}
        </span>
        <span className="block text-muted-foreground text-xs mt-0.5 font-light tracking-wide">{sub}</span>
      </div>
      <a
        href="https://sediba-wellness-clinic.salonbridge.website/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-5 shrink-0"
      >
        <span className="font-medium text-sm text-foreground tracking-wider">{price}</span>
        <span className="uppercase tracking-widest text-[10px] text-muted-foreground hover:text-primary transition-colors">
          Book
        </span>
      </a>
    </motion.div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function Services() {
  return (
    <div className="pt-32 pb-24 min-h-screen bg-background">
      <div className="container px-6 mx-auto max-w-5xl">

        {/* Page header */}
        <motion.div
          className="max-w-2xl mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">
            Treatment Menu
          </span>
          <h1 className="font-serif text-5xl md:text-6xl text-foreground mb-6">Our Treatments</h1>
          <p className="text-muted-foreground text-lg font-light leading-relaxed">
            Expert care. Personalised results. Timeless you.
          </p>
        </motion.div>

        {/* ── SKIN ──────────────────────────────────────────────────────── */}
        <motion.section
          className="mb-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <SectionDivider label="Skin" />

          {/* Skin — two-column layout: text list + portrait image */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            <div className="lg:col-span-3">
              <p className="text-xs font-sans uppercase tracking-[0.2em] text-primary mb-2">
                Your skin, your goals, your prescription.
              </p>
              <p className="text-muted-foreground text-sm font-light leading-relaxed mb-8">
                Personalised professional skin treatments using Dermalogica, DMK and Dermaclinical,
                prescribed for your unique skin needs.
              </p>
              {SKIN.map((t, i) => <TreatmentRow key={t.name} {...t} idx={i} />)}
            </div>

            {/* Skin portrait */}
            <motion.div
              className="lg:col-span-2 sticky top-36"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative overflow-hidden aspect-[3/4]">
                <img
                  src="/glass-skin.jpg"
                  alt="Glass skin result — radiant complexion"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground text-center">
                Skin · Glow · Radiance
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* ── ADVANCED AESTHETICS ───────────────────────────────────────── */}
        <motion.section
          className="mb-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <SectionDivider label="Advanced Aesthetics" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            {/* Aesthetics image */}
            <motion.div
              className="lg:col-span-2 sticky top-36"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative overflow-hidden aspect-[3/4]">
                <img
                  src="/advanced-aesthetics.jpg"
                  alt="Advanced body contouring treatment at Sediba"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground text-center">
                Aesthetics · Technology · Results
              </p>
            </motion.div>

            <div className="lg:col-span-3">
              {ADVANCED.map((t, i) => <TreatmentRow key={t.name} {...t} idx={i} />)}
            </div>
          </div>
        </motion.section>

        {/* ── BODY & WELLNESS ───────────────────────────────────────────── */}
        <motion.section
          className="mb-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <SectionDivider label="Body & Wellness" />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            <div className="lg:col-span-3">
              {BODY.map((t, i) => <TreatmentRow key={t.name} {...t} idx={i} />)}
            </div>

            {/* Body massage image — right */}
            <motion.div
              className="lg:col-span-2 sticky top-36"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative overflow-hidden aspect-[3/4]">
                <img
                  src="/body-massage.jpg"
                  alt="Sediba body massage treatment"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground text-center">
                Body · Wellness · Restore
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* ── HANDS & FEET ──────────────────────────────────────────────── */}
        <motion.section
          className="mb-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <SectionDivider label="Hands & Feet" />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            {/* Hands portrait — left */}
            <motion.div
              className="lg:col-span-2 sticky top-36"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative overflow-hidden aspect-[3/4]">
                <img
                  src="/hands-nails.jpg"
                  alt="Luxury manicure treatment at Sediba"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground text-center">
                Hands · Precision · Care
              </p>
            </motion.div>

            <div className="lg:col-span-3">
              {HANDS_FEET.map((t, i) => <TreatmentRow key={t.name} {...t} idx={i} />)}
            </div>
          </div>
        </motion.section>

        {/* ── SKIN CONSULTATION CARD ────────────────────────────────────── */}
        <motion.div
          className="border border-primary/40 bg-card p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex-1">
            <span className="text-xs uppercase tracking-[0.2em] text-primary block mb-3">
              Your Skin, Your Prescription
            </span>
            <h3 className="font-serif text-2xl text-foreground mb-3">Skin Consultation</h3>
            <p className="text-muted-foreground text-sm font-light leading-relaxed max-w-md">
              Not sure where to begin? Start with a 30-minute Skin Consultation. We assess your skin,
              listen to your goals and create a personalised treatment prescription designed around you.
            </p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-4 shrink-0">
            <div className="text-center md:text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">30 min</p>
              <p className="font-serif text-3xl text-foreground">R350</p>
            </div>
            <a
              href="https://sediba-wellness-clinic.salonbridge.website/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-foreground px-8 py-3 text-xs uppercase tracking-[0.2em] text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              Book Consultation
            </a>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
