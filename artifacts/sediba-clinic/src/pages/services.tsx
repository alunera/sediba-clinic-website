import { useListServices, getListServicesQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const SECTION_ORDER: Record<string, { label: string; section: string }> = {
  "Dermalogica":        { section: "Skin Treatments", label: "Dermalogica" },
  "DMK Enzyme Therapy": { section: "Skin Treatments", label: "DMK Enzyme Therapy" },
  "Nail Treatments":    { section: "Nail & Grooming", label: "Nail Treatments" },
  "Grooming":           { section: "Nail & Grooming", label: "Grooming" },
  "Massages":           { section: "Massage & Wellness", label: "Massages" },
  "Waxing":             { section: "Waxing", label: "Waxing" },
};

const SECTION_DISPLAY_ORDER = ["Skin Treatments", "Nail & Grooming", "Massage & Wellness", "Waxing"];

export default function Services() {
  const { data: services, isLoading } = useListServices({
    query: { queryKey: getListServicesQueryKey() }
  });

  const sections: Record<string, { category: string; services: typeof services }[]> = {};

  if (services) {
    for (const sectionName of SECTION_DISPLAY_ORDER) {
      sections[sectionName] = [];
    }
    const categories = Array.from(new Set(services.map(s => s.category)));
    for (const cat of categories) {
      const meta = SECTION_ORDER[cat];
      const sectionName = meta?.section ?? cat;
      if (!sections[sectionName]) sections[sectionName] = [];
      sections[sectionName].push({
        category: meta?.label ?? cat,
        services: services.filter(s => s.category === cat),
      });
    }
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-background">
      <div className="container px-6 mx-auto">
        <div className="max-w-3xl mb-16">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">Treatment Menu</span>
          <h1 className="font-serif text-5xl text-foreground mb-6">Our Treatments</h1>
          <p className="text-muted-foreground text-lg font-light leading-relaxed">
            A comprehensive portfolio of skin, nail, massage, waxing, and grooming treatments — delivered with care and precision.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 bg-muted w-48 mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-48 bg-muted/50 border border-border" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-24">
            {SECTION_DISPLAY_ORDER.filter(s => sections[s]?.length > 0).map((sectionName, sIdx) => (
              <motion.div
                key={sectionName}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Section header */}
                <div className="flex items-center gap-6 mb-10">
                  <h2 className="font-serif text-4xl text-foreground whitespace-nowrap">{sectionName}</h2>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Sub-categories within section */}
                <div className="space-y-14">
                  {sections[sectionName].map(({ category, services: catServices }) => (
                    <div key={category}>
                      {sections[sectionName].length > 1 && (
                        <p className="text-xs font-sans uppercase tracking-[0.25em] text-primary mb-6">{category}</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {catServices?.map((service, idx) => (
                          <motion.div
                            key={service.id}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.45, delay: idx * 0.06 }}
                            className="group flex flex-col bg-card border border-border p-7 hover:border-primary/50 transition-colors"
                          >
                            <div className="flex-grow">
                              <div className="flex justify-between items-start gap-4 mb-3">
                                <h3 className="font-serif text-lg text-foreground leading-snug">{service.name}</h3>
                                <span className="text-sm font-medium text-foreground tracking-widest whitespace-nowrap shrink-0">
                                  {service.price === 0 ? "Complimentary" : `R${service.price}`}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {service.description}
                              </p>
                            </div>
                            <div className="pt-5 border-t border-border flex items-center justify-between mt-5">
                              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                                {service.duration} min
                              </span>
                              <a
                                href="https://sediba-wellness-clinic.salonbridge.website/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="uppercase tracking-widest text-xs text-foreground hover:text-primary transition-colors"
                              >
                                Book
                              </a>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
