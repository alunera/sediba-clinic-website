import { motion } from "framer-motion";

export default function About() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <div className="w-full bg-background pt-32">
      {/* Story Section */}
      <section className="container px-6 mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-6 block">Our Story</span>
            <h1 className="font-serif text-4xl md:text-6xl text-foreground mb-8 leading-tight">
              A profound approach to personal architecture.
            </h1>
            <div className="space-y-6 text-muted-foreground font-light leading-relaxed">
              <p>
                Founded in Sandton, Sediba Aesthetic & Wellness Clinic was born from a singular vision: to elevate aesthetic medicine from a transactional service to a deeply considered art form.
              </p>
              <p>
                We reject the industry standard of artificial augmentation. Instead, our clinical philosophy revolves around restoration, optimization, and subtle enhancement. We believe that the most compelling results are entirely invisible to the untrained eye.
              </p>
              <p>
                Our sanctuary was architecturally designed to calm the nervous system the moment you step inside. Natural textures, muted acoustics, and unhurried consultations ensure that your time with us is restorative.
              </p>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="aspect-[4/5] relative"
          >
            <img src="/about.png" alt="Sediba Clinic Architecture" className="w-full h-full object-cover" />
          </motion.div>
        </div>
      </section>

      {/* The Space */}
      <section className="bg-muted/30 py-32 border-y border-border">
        <div className="container px-6 mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="max-w-3xl mx-auto"
          >
            <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-6 block">The Sanctuary</span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
              Designed for discretion and calm.
            </h2>
            <p className="text-muted-foreground font-light leading-relaxed">
              Our clinic environment mirrors our aesthetic approach: refined, highly considered, and lacking excess. White marble, warm woods, and matte black finishes create a gallery-like atmosphere where clinical excellence meets architectural beauty. Private recovery suites ensure absolute discretion post-procedure.
            </p>
          </motion.div>
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
                <p className="font-serif text-xl mb-4">Sediba Clinic</p>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  14 Wellness Boulevard<br />
                  Sandton, 2196<br />
                  Johannesburg, South Africa
                </p>
                
                <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2 mt-8">Hours</h4>
                <div className="text-muted-foreground text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span>09:00 - 18:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span>10:00 - 15:00</span>
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
              <h3 className="font-serif text-3xl text-foreground mb-10">Direct Contact</h3>
              <div className="space-y-8">
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">Concierge</h4>
                  <p className="text-foreground text-lg">+27 11 555 0199</p>
                </div>
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">Email</h4>
                  <p className="text-foreground text-lg">concierge@sedibaclinic.co.za</p>
                </div>
                <div>
                  <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-primary mb-2">Press & Media</h4>
                  <p className="text-foreground text-lg">press@sedibaclinic.co.za</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
