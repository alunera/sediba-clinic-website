import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const stagger = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[100dvh] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero.png" 
            alt="Sediba Clinic Interior" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        
        <div className="container relative z-10 px-6 pt-32 text-center text-white">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-4xl mx-auto flex flex-col items-center"
          >
            <motion.span variants={fadeIn} className="text-primary font-sans uppercase tracking-[0.3em] text-sm mb-6 block">
              The Art of Refinement
            </motion.span>
            <motion.h1 variants={fadeIn} className="font-serif text-5xl md:text-7xl lg:text-8xl leading-tight mb-8">
              Aesthetic Medicine.<br/>Holistic Wellness.
            </motion.h1>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-light tracking-wide text-white/90 max-w-2xl mb-12">
              A private sanctuary where advanced medical aesthetics and bespoke wellness converge.
            </motion.p>
            <motion.div variants={fadeIn}>
              <Link href="/book">
                <Button size="lg" className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-7 text-sm uppercase tracking-[0.2em]">
                  Reserve Your Time
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-32 bg-background">
        <div className="container px-6 mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
              True luxury is intentional. It is unhurried.
            </h2>
            <p className="text-muted-foreground leading-relaxed md:text-lg font-light">
              At Sediba, we believe self-care is an investment, not an indulgence. Our clinicians blend world-class medical expertise with an artistic eye, delivering results that are striking yet perfectly calibrated to your natural architecture.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="py-24 bg-muted/30">
        <div className="container px-6 mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16">
            <div>
              <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">Our Disciplines</span>
              <h2 className="font-serif text-4xl text-foreground">Curated Treatments</h2>
            </div>
            <Link href="/services">
              <Button variant="link" className="text-foreground hover:text-primary uppercase tracking-widest text-xs px-0 mt-6 md:mt-0 flex items-center gap-2">
                View Full Menu <ArrowRight size={14} />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Aesthetic Medicine", image: "/aesthetic.png", desc: "Injectables, biostimulators, and profound rejuvenation." },
              { title: "Skin Health", image: "/skin.png", desc: "Advanced laser, micro-needling, and restorative peels." },
              { title: "Holistic Wellness", image: "/wellness.png", desc: "IV therapy, body contouring, and metabolic optimization." }
            ].map((cat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[3/4] overflow-hidden mb-6">
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500 z-10" />
                  <img 
                    src={cat.image} 
                    alt={cat.title} 
                    className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </div>
                <h3 className="font-serif text-2xl text-foreground mb-3">{cat.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{cat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiator */}
      <section className="py-32 bg-foreground text-white">
        <div className="container px-6 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-6 block">The Sediba Standard</span>
            <h2 className="font-serif text-4xl md:text-5xl mb-8 leading-tight">Mastery in every detail.</h2>
            <div className="space-y-8">
              {[
                { title: "Clinical Excellence", desc: "Board-certified practitioners utilizing FDA-approved, vanguard technologies." },
                { title: "Bespoke Protocols", desc: "No templates. Every treatment plan is architected specifically for your physiology." },
                { title: "Private Sanctuary", desc: "A discreet, gallery-like environment designed to soothe the nervous system." }
              ].map((item, i) => (
                <div key={i} className="border-l-2 border-primary/30 pl-6">
                  <h4 className="font-serif text-xl mb-2">{item.title}</h4>
                  <p className="text-white/60 font-light text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="aspect-square relative"
          >
            <img src="/about.png" alt="Clinic Interior" className="object-cover w-full h-full" />
          </motion.div>
        </div>
      </section>

      {/* AI Assistant CTA */}
      <section className="py-24 bg-background">
        <div className="container px-6 mx-auto">
          <div className="bg-muted/30 p-12 md:p-20 text-center max-w-4xl mx-auto border border-border">
            <h2 className="font-serif text-3xl md:text-4xl mb-6 text-foreground">Consult with Sedi</h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
              Not sure which treatment suits your needs? Chat with our intelligent concierge to explore options and seamlessly schedule your visit.
            </p>
            <Link href="/ai-assistant">
              <Button variant="outline" className="rounded-none border-foreground text-foreground hover:bg-foreground hover:text-white px-8 py-6 uppercase tracking-widest text-xs">
                Start Conversation
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
