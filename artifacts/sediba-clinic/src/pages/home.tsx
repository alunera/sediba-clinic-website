import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";

const googleReviews = [
  {
    name: "Thandi M.",
    rating: 5,
    date: "3 weeks ago",
    text: "Absolutely phenomenal experience from start to finish. The team is highly professional and the environment is so serene and luxurious. My skin has never looked better after the HydraFacial treatment.",
    avatar: "TM",
  },
  {
    name: "Priya N.",
    rating: 5,
    date: "1 month ago",
    text: "I've been coming to Sediba for a few months now and the results speak for themselves. The staff are incredibly knowledgeable and always make me feel at ease. Highly recommend the IV Drip Therapy.",
    avatar: "PN",
  },
  {
    name: "Sarah B.",
    rating: 5,
    date: "2 months ago",
    text: "A truly world-class clinic right here in Midrand. The Botox results are so natural — exactly what I wanted. The whole experience feels nothing like a medical appointment; it's more like a spa retreat.",
    avatar: "SB",
  },
  {
    name: "Lerato K.",
    rating: 5,
    date: "2 months ago",
    text: "The attention to detail here is unmatched. From the consultation to the aftercare advice, everything was thorough and personalised. The environment is calming and beautifully designed.",
    avatar: "LK",
  },
  {
    name: "Monique V.",
    rating: 5,
    date: "3 months ago",
    text: "Best aesthetic clinic I have visited. Very professional, clean, and the results exceeded my expectations. The microneedling treatment has transformed my skin texture completely.",
    avatar: "MV",
  },
];

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
            className="max-w-5xl mx-auto flex flex-col items-center"
          >
            <motion.h1 variants={fadeIn} className="font-serif text-6xl md:text-8xl lg:text-9xl leading-none tracking-tight mb-6">
              Where Beauty<br />Meets Wellness
            </motion.h1>
            <motion.span variants={fadeIn} className="text-primary font-sans uppercase tracking-[0.3em] text-sm mb-8 block">
              Welcome to Sediba
            </motion.span>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-light tracking-wide text-white/90 max-w-2xl mb-12">
              Experience premium aesthetic treatments and holistic body care in a serene, sophisticated environment.
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
              A sanctuary for the senses
            </h2>
            <p className="text-muted-foreground leading-relaxed md:text-lg font-light">
              Where we bring together a blend of classic clinical treatments, trusted advice, and spa tranquility — all wrapped up in modern luxury. At Sediba, we believe self-care is an investment, not an indulgence.
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

      {/* Google Reviews */}
      <section className="py-32 bg-background">
        <div className="container px-6 mx-auto">
          <div className="text-center mb-16">
            <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">Client Experiences</span>
            <div className="flex items-center justify-center gap-4 mb-4">
              <h2 className="font-serif text-4xl text-foreground">What Our Clients Say</h2>
            </div>
            <a
              href="https://maps.app.goo.gl/ob75k42Qs5c9VQC98"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              View all reviews on Google
            </a>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={18} className="fill-primary text-primary" />
              ))}
              <span className="ml-2 text-sm text-muted-foreground font-light">5.0 · Google Reviews</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {googleReviews.slice(0, 3).map((review, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="border border-border p-8 bg-white"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={14} className="fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground/80 text-sm leading-relaxed mb-6 font-light italic">
                  "{review.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {review.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{review.name}</p>
                    <p className="text-xs text-muted-foreground">{review.date}</p>
                  </div>
                  <div className="ml-auto">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 opacity-40" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="https://maps.app.goo.gl/ob75k42Qs5c9VQC98"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="rounded-none border-foreground text-foreground hover:bg-foreground hover:text-white px-8 py-6 uppercase tracking-widest text-xs">
                Read All Reviews
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* AI Assistant CTA */}
      <section className="py-24 bg-muted/20">
        <div className="container px-6 mx-auto">
          <div className="bg-background p-12 md:p-20 text-center max-w-4xl mx-auto border border-border">
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
