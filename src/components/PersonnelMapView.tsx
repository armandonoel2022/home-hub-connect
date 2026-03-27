import { useEffect, useRef } from "react";
import type { ArmedPersonnel } from "@/lib/types";

function parseCoords(coord?: string): [number, number] | null {
  if (!coord) return null;
  const parts = coord.split(",").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
  return null;
}

export default function PersonnelMapView({ personnel }: { personnel: ArmedPersonnel[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const center = parseCoords(personnel[0]?.coordinates) || [18.5, -69.9];
      const map = L.map(containerRef.current).setView(center as [number, number], 9);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      personnel.forEach(p => {
        const pos = parseCoords(p.coordinates);
        if (!pos) return;
        const condIcon = p.weaponCondition?.includes("buenas") || p.weaponCondition === "En condiciones" ? "🟢" : p.weaponCondition?.includes("mantenimiento") ? "🟡" : "🔴";
        L.marker(pos).addTo(map).bindPopup(`
          <div style="font-size:12px;min-width:180px">
            <p style="font-weight:bold">${condIcon} ${p.name || "Sin nombre"}</p>
            <p><strong>Código:</strong> ${p.employeeCode}</p>
            <p><strong>Cliente:</strong> ${p.client}</p>
            <p><strong>Puesto:</strong> ${p.location}</p>
            <p><strong>Provincia:</strong> ${p.province}</p>
            <p><strong>Arma:</strong> ${p.weaponType} ${p.weaponBrand}</p>
            <p><strong>Serial:</strong> ${p.weaponSerial}</p>
            <p><strong>Estado:</strong> ${p.weaponCondition}</p>
            <a href="https://www.google.com/maps?q=${p.coordinates}" target="_blank" style="color:#2563eb;text-decoration:underline">Abrir en Google Maps</a>
          </div>
        `);
      });

      // Force resize
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [personnel]);

  return <div ref={containerRef} className="h-[500px] rounded-xl overflow-hidden border border-border" />;
}
