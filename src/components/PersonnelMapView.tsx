import { useEffect, useRef, useState } from "react";
import type { ArmedPersonnel } from "@/lib/types";
import { parseAnyCoords, resolveMapsUrlsBatch, isMapsUrl } from "@/lib/geoResolver";

function parseCoords(coord?: string): [number, number] | null {
  if (!coord) return null;
  return parseAnyCoords(coord);
}

interface Props {
  personnel: ArmedPersonnel[];
  onTransfer?: (person: ArmedPersonnel) => void;
}

export default function PersonnelMapView({ personnel, onTransfer }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const callbackRef = useRef(onTransfer);
  callbackRef.current = onTransfer;

  const [resolvedMap, setResolvedMap] = useState<Record<string, string>>({});

  // Store personnel in ref for event handlers
  const personnelRef = useRef(personnel);
  personnelRef.current = personnel;

  // Resolve any short Google Maps URLs (maps.app.goo.gl) into lat,lng via backend.
  useEffect(() => {
    const urls = personnel
      .map(p => p.coordinates)
      .filter(c => c && isMapsUrl(c) && !parseAnyCoords(c));
    if (urls.length === 0) return;
    let cancelled = false;
    resolveMapsUrlsBatch(urls).then(map => {
      if (!cancelled && Object.keys(map).length) setResolvedMap(prev => ({ ...prev, ...map }));
    });
    return () => { cancelled = true; };
  }, [personnel]);

  useEffect(() => {
    if (!containerRef.current) return;
    // Re-init map when personnel or resolved coords change
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

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

      // Make transfer handler available globally for popup buttons
      (window as any).__personnelTransfer = (id: string) => {
        const p = personnelRef.current.find(x => x.id === id);
        if (p && callbackRef.current) callbackRef.current(p);
      };

      personnel.forEach(p => {
        const pos = parseCoords(p.coordinates);
        if (!pos) return;
        const condIcon = p.weaponCondition?.includes("buenas") || p.weaponCondition === "En condiciones" ? "🟢" : p.weaponCondition?.includes("mantenimiento") ? "🟡" : "🔴";
        const shiftLabel = p.shiftType ? `<p><strong>Turno:</strong> ${p.shiftType}${p.shiftHours ? ` (${p.shiftHours}h)` : ""}</p>` : "";
        const transferBtn = callbackRef.current ? `<button onclick="window.__personnelTransfer('${p.id}')" style="margin-top:6px;padding:4px 10px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;width:100%">⇄ Transferir Puesto</button>` : "";

        L.marker(pos).addTo(map).bindPopup(`
          <div style="font-size:12px;min-width:200px">
            <p style="font-weight:bold;margin-bottom:4px">${condIcon} ${p.name || "Sin nombre"}</p>
            <p><strong>Código:</strong> ${p.employeeCode}</p>
            <p><strong>Cliente:</strong> ${p.client}</p>
            <p><strong>Puesto:</strong> ${p.location}</p>
            <p><strong>Provincia:</strong> ${p.province}</p>
            <p><strong>Arma:</strong> ${p.weaponType} ${p.weaponBrand}</p>
            <p><strong>Serial:</strong> ${p.weaponSerial}</p>
            <p><strong>Estado:</strong> ${p.weaponCondition}</p>
            ${shiftLabel}
            <a href="https://www.openstreetmap.org/?mlat=${pos[0]}&mlon=${pos[1]}#map=17/${pos[0]}/${pos[1]}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;font-size:11px">Abrir en OpenStreetMap</a>
            ${transferBtn}
          </div>
        `);
      });

      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      if ((window as any).__personnelTransfer) delete (window as any).__personnelTransfer;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [personnel]);

  return <div ref={containerRef} className="h-[500px] rounded-xl overflow-hidden border border-border" />;
}
