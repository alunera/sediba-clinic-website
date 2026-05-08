import { useListServices, getListServicesQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Services() {
  const { data: services, isLoading } = useListServices({
    query: { queryKey: getListServicesQueryKey() }
  });

  const categories = services ? Array.from(new Set(services.map(s => s.category))) : [];

  return (
    <div className="pt-32 pb-24 min-h-screen bg-background">
      <div className="container px-6 mx-auto">
        <div className="max-w-3xl mb-16">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block">Menu</span>
          <h1 className="font-serif text-5xl text-foreground mb-6">Our Treatments</h1>
          <p className="text-muted-foreground text-lg font-light leading-relaxed">
            A comprehensive portfolio of aesthetic and wellness protocols, delivered with exacting precision.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-12">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 bg-muted w-48 mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-64 bg-muted/50 border border-border"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-24">
            {categories.map((category, catIdx) => (
              <motion.div 
                key={category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="border-b border-border pb-4 mb-8 flex justify-between items-end">
                  <h2 className="font-serif text-3xl text-foreground">{category}</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {services?.filter(s => s.category === category).map((service, idx) => (
                    <motion.div 
                      key={service.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      className="group flex flex-col h-full bg-card border border-border p-8 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-serif text-xl text-foreground">{service.name}</h3>
                          <span className="text-sm font-medium text-foreground tracking-widest">
                            R{service.price}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                          {service.description}
                        </p>
                      </div>
                      <div className="pt-6 border-t border-border flex items-center justify-between mt-auto">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground">
                          {service.duration} Min
                        </span>
                        <Link href={`/book?service=${service.id}`}>
                          <Button variant="link" className="uppercase tracking-widest text-xs text-foreground hover:text-primary px-0">
                            Book
                          </Button>
                        </Link>
                      </div>
                    </motion.div>
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
