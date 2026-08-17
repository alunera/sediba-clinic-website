import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const principles = [
  {
    title: "Experienced",
    desc: "Years of hands-on aesthetic, skin and body experience.",
  },
  {
    title: "Personalised",
    desc: "Your treatment is prescribed according to your skin, goals and progress.",
  },
  {
    title: "Results-focused",
    desc: "We measure success through real skin transformation.",
  },
  {
    title: "Holistic 360 Approach",
    desc: "Skin, body and wellbeing are treated as part of the same experience, combining gut support and hormonal support.",
  },
];

const steps = [
  { num: "01", text: "Schedule an appointment by email, online or call us." },
  { num: "02", text: "One-on-one consultation: establishing your skin concern by analysing your skin, lifestyle and treatment history." },
  { num: "03", text: "Treatment plan and home care prescribed products to maintain your healthy skin." },
  { num: "04", text: "Your skin journey begins." },
];

export default function About() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <div className="w-full bg-background pt-32">

      {/* Story Section */}
      <section className="container px-6 mx-auto mb-32">
        <div className="max-w-3xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-6 block">Our Story</span>
            <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-8 leading-tight">
              Care begins with experience
            </h1>
            <div className="space-y-6 text-muted-foreground font-light leading-relaxed">
              <p>
                At Sediba Aesthetic and Wellness Clinic care begins with experience.
              </p>
              <p>
                Every skin is different. Every concern has a story. And every treatment should have a purpose.
              </p>
              <p>
                Our approach combines professional skin knowledge, advanced aesthetic treatments and restorative wellness to create personalised treatment pathways designed around you.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Guiding Principles */}
      <section className="bg-foreground text-white py-32">
        <div className="container px-6 mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center mb-16"
          >
            <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">What Drives Us</span>
            <h2 className="font-serif text-4xl">Why Sediba</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {principles.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="border-l-2 border-primary/40 pl-8"
              >
                <h3 className="font-serif text-2xl mb-4">{p.title}</h3>
                <p className="text-white/60 font-light leading-relaxed text-sm">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Process */}
      <section className="py-32 bg-muted/20">
        <div className="container px-6 mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center mb-16"
          >
            <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">How It Works</span>
            <h2 className="font-serif text-4xl text-foreground">Our Process</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                className="text-center"
              >
                <p className="font-serif text-5xl text-primary/30 mb-4">{step.num}</p>
                <p className="text-muted-foreground text-sm leading-relaxed font-light">{step.text}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/book">
              <Button className="rounded-none px-12 py-6 uppercase tracking-widest text-xs">
                Book Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact & Location */}
      <section className="py-32">
        <div className="container px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h3 className="font-serif text-3xl text-foreground mb-10">Location</h3>
              <div className="p-8 border border-border bg-card">
                <p className="font-serif text-xl mb-4">Sediba Aesthetic & Wellness Clinic</p>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Hertford Office Park<br />
                  Building M<br />
                  Waterfall, Midrand
                </p>
                <p className="text-xs text-muted-foreground italic">Free parking available on premises.</p>
                <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2 mt-8">Hours</h4>
                <div className="text-muted-foreground text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Monday to Friday</span>
                    <span>09:00 to 18:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span>10:00 to 15:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span>Closed</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeIn}
            >
              <h3 className="font-serif text-3xl text-foreground mb-10">Get in Touch</h3>
              <div className="space-y-8">
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">Phone</h4>
                  <a href="tel:+27814566402" className="text-foreground text-lg hover:text-primary transition-colors">
                    081 456 6402
                  </a>
                </div>
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">Email</h4>
                  <a href="mailto:info@sedibawellnessclinic.co.za" className="text-foreground text-lg hover:text-primary transition-colors">
                    info@sedibawellnessclinic.co.za
                  </a>
                </div>
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">Book Online</h4>
                  <Link href="/book" className="text-foreground text-lg hover:text-primary transition-colors">
                    Reserve your appointment
                  </Link>
                </div>
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">Sedi Assistant</h4>
                  <Link href="/ai-assistant" className="text-foreground text-lg hover:text-primary transition-colors">
                    Chat to Sedi for all the questions you need
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
