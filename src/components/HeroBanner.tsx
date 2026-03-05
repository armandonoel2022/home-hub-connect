import bannerImg from "@/assets/safeone-building.jpeg";
import { Shield, Clock, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const HeroBanner = () => {
  const { user } = useAuth();
  const today = new Date();
  const dateStr = today.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="relative h-64 md:h-80 overflow-hidden">
      <img
        src={bannerImg}
        alt="SafeOne Security Company"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="hero-overlay absolute inset-0" />
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-center">
        <p className="text-gold font-heading font-semibold text-sm uppercase tracking-widest mb-2">
          {user ? `Hola, ${user.fullName.split(" ")[0]}` : "Bienvenido a la Intranet"}
        </p>
        <h1 className="font-heading font-black text-3xl md:text-5xl text-secondary-foreground leading-tight">
          SafeOne Security
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base capitalize">{dateStr}</p>

        <div className="flex gap-6 mt-6">
          {[
            { icon: Shield, label: "Seguridad Activa" },
            { icon: Clock, label: "24/7 Monitoreo" },
            { icon: Users, label: "9 Departamentos" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-secondary-foreground/80 text-xs md:text-sm">
              <Icon className="h-4 w-4 text-gold" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
