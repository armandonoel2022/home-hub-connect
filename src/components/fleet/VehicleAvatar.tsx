import { Car, Truck, Bike, Bus, CarFront, HelpCircle } from "lucide-react";
import type { VehicleType } from "@/lib/vehicleTypes";

const ICONS: Record<VehicleType, typeof Car> = {
  SUV: CarFront,
  Automovil: Car,
  Motocicleta: Bike,
  Camioneta: Truck,
  Furgon: Bus,
  Otro: HelpCircle,
};

const TONES: Record<VehicleType, string> = {
  SUV: "bg-amber-100 text-amber-700",
  Automovil: "bg-blue-100 text-blue-700",
  Motocicleta: "bg-emerald-100 text-emerald-700",
  Camioneta: "bg-orange-100 text-orange-700",
  Furgon: "bg-purple-100 text-purple-700",
  Otro: "bg-muted text-muted-foreground",
};

interface Props {
  tipo: VehicleType;
  photo?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { box: "h-9 w-9", icon: "h-4 w-4" },
  md: { box: "h-12 w-12", icon: "h-6 w-6" },
  lg: { box: "h-20 w-20", icon: "h-10 w-10" },
};

const VehicleAvatar = ({ tipo, photo, size = "md" }: Props) => {
  const Icon = ICONS[tipo] || HelpCircle;
  const s = SIZES[size];
  if (photo) {
    return (
      <img
        src={photo}
        alt={`Vehículo ${tipo}`}
        className={`${s.box} rounded-lg object-cover border border-border`}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`${s.box} ${TONES[tipo] || TONES.Otro} rounded-lg flex items-center justify-center`}>
      <Icon className={s.icon} />
    </div>
  );
};

export default VehicleAvatar;
