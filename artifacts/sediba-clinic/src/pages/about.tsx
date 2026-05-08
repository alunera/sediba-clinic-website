import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const principles = [
  {
    title: "Expertise",
    desc: "We remain curious and constantly seek to acquire and build deep knowledge, skills and critical experience in our specialised fields, and areas of service delivery.",
  },
  {
    title: "Proven Results",
    desc: "We strive to find the best personalised care for your specific wellbeing aims and/or concerns, in order to enhance your treatment results and experience.",
  },
  {
    title: "Service Excellence",
    desc: "Our professional staff are committed to providing the safest and most effective care and service.",
  },
];

const steps = [
  { num: "01", text: "Schedule an appointment by email, online, WhatsApp or call us." },
  { num: "02", text: "One-on-one consultation — establishing your skin concern by analysing your skin, lifestyle and treatment history." },
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
              A sanctuary for the senses
            </h1>
            <div className="space-y-6 text-muted-foreground font-light leading-relaxed">
              <p>
                We bring together a blend of classic clinical treatments, trusted advice, and spa tranquility — all wrapped up in modern luxury.
              </p>
              <p>
                At Sediba Wellness Clinic you can expect to be greeted by the cream of the crop health and skincare therapists, massage specialists, and nail technicians. Our team has amassed years of experience, and are best placed to deliver excellent service, and offer you advice that supports your wellness goals.
              </p>
              <p>
                We offer supporting product ranges from leading brands, including <strong className="text-foreground font-medium">Dermalogica</strong>, <strong className="text-foreground font-medium">DMK</strong>, <strong className="text-foreground font-medium">Depelive</strong> and <strong className="text-foreground font-medium">CND</strong>. These brands are inspired by nature and propelled by science — vegan friendly, cruelty free, and environmentally conscious.
              </p>
              <p>
                Our clinic is fully kitted out with three comfortable treatment rooms, as well as a manicure and pedicure zone that is partially hidden — ensuring that you enjoy absolute comfort and privacy.
              </p>
              <p>
                The highlight of every Sediba experience is that we take great care and intention in walking you through your urban retreat away from the pressures of modern life. Every colour, sound, scent, and texture has been carefully selected to enhance your experience and treatment results. We want you to always walk out feeling pampered, revitalised, and at your very best.
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
            <h2 className="font-serif text-4xl">Our Guiding Principles</h2>
            <p className="text-white/60 mt-4 font-light max-w-xl mx-auto">
              Sediba Wellness Clinic was founded on three principles:
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
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
                  90 Bekker Road, Vorna Valley<br />
                  Midrand, South Africa
                </p>
                <p className="text-xs text-muted-foreground italic">Free parking available on premises.</p>
                <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2 mt-8">Hours</h4>
                <div className="text-muted-foreground text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Monday – Friday</span>
                    <span>09:00 – 18:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span>10:00 – 15:00</span>
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
                  <Link href="/book">
                    <span className="text-foreground text-lg hover:text-primary transition-colors cursor-pointer">
                      Reserve your appointment
                    </span>
                  </Link>
                </div>
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">WhatsApp</h4>
                  <a
                    href="https://wa.me/27814566402"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground text-lg hover:text-primary transition-colors"
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
