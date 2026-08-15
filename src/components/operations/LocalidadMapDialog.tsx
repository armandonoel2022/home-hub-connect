import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink, Loader2 } from "lucide-react";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import { loadPosts } from "@/lib/postsData";
import { parseAnyCoords, resolveMapsUrl } from "@/lib/geoResolver";

interface Props {
  cliente: string;
  localidad: string;
  direccion?: string;
  puestos: string[];
  onClose: () => void;
}

type Point = { label: string; pos: [number, number]; origen: string };

const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Mapa de solo lectura para una localidad del expediente (no altera datos). */
export default function LocalidadMapDialog({ cliente, localidad, direccion, puestos, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const { data: personnel } = useArmedPersonnel();
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  const rawCandidates = useMemo(() => {
    const c = norm(cliente);
    const loc = norm(localidad);
    const wanted = new Set(puestos.map(norm));
    const out: { label: string; coord: string; origen: string }[] = [];

    (personnel || []).forEach((p: any) => {
      if (!p?.coordinates) return;
      if (norm(p.client) !== c && !norm(p.client).includes(c) && !c.includes(norm(p.client))) return;
      const l = norm(p.location);
      if (loc && l !== loc && !wanted.has(l) && !l.includes(loc)) return;
      out.push({ label: p.location || localidad, coord: p.coordinates, origen: "Personal Armado" });
    });

    try {
      loadPosts().forEach((wp) => {
        if (!wp.coordenada) return;
        const wc = norm(wp.cliente);
        if (wc !== c && !wc.includes(c) && !c.includes(wc)) return;
        const n = norm(wp.nombre);
        if (loc && n !== loc && !wanted.has(n) && !n.includes(loc)) return;
        out.push({ label: wp.nombre || localidad, coord: wp.coordenada, origen: "Puestos" });
      });
    } catch { /* opcional */ }

    return out;
  }, [personnel, cliente, localidad, puestos]);

  // Resolver coordenadas (lat,lng directos, URLs de Google Maps o geocodificación de la dirección)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resolved: Point[] = [];
      const seen = new Set<string>();
      for (const c of rawCandidates) {
        const pos = parseAnyCoords(c.coord) || (await resolveMapsUrl(c.coord));
        if (!pos) continue;
        const key = `${pos[0].toFixed(5)},${pos[1].toFixed(5)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        resolved.push({ label: c.label, pos, origen: c.origen });
      }

      if (resolved.length === 0 && direccion) {
        try {
          const q = encodeURIComponent(`${direccion}, República Dominicana`);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
          const js = await res.json();
          if (Array.isArray(js) && js[0]) {
            resolved.push({
              label: direccion,
              pos: [parseFloat(js[0].lat), parseFloat(js[0].lon)],
              origen: "Dirección del cliente",
            });
          }
        } catch { /* sin geocodificación */ }
      }

      if (!cancelled) { setPoints(resolved); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [rawCandidates, direccion]);

  useEffect(() => {
    if (loading || points.length === 0) return;
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

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(containerRef.current).setView(points[0].pos, 15);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      points.forEach((pt) => {
        L.marker(pt.pos).addTo(map).bindPopup(
          `<div style="font-size:12px;min-width:180px">
            <p style="font-weight:bold;margin-bottom:4px">${pt.label}</p>
            <p>${cliente}</p>
            <p style="color:#6b7280">Fuente: ${pt.origen}</p>
            <a href="https://www.openstreetmap.org/?mlat=${pt.pos[0]}&mlon=${pt.pos[1]}#map=17/${pt.pos[0]}/${pt.pos[1]}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">Abrir en OpenStreetMap</a>
          </div>`,
        );
      });

      if (points.length > 1) map.fitBounds(points.map((p) => p.pos) as any, { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [loading, points, cliente]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-gold" /> {localidad}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">{cliente}</Badge>
            {direccion && <span className="truncate">{direccion}</span>}
            <Badge variant="outline" className="text-[10px]">Solo lectura</Badge>
          </div>

          {loading ? (
            <div className="h-[420px] rounded-xl border border-border flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Ubicando localidad…
            </div>
          ) : points.length === 0 ? (
            <div className="h-[420px] rounded-xl border border-border flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
              <MapPin className="h-6 w-6" />
              <p>No hay coordenadas registradas para esta localidad en Personal Armado ni en Puestos.</p>
              {direccion && (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(direccion)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Buscar la dirección en OpenStreetMap <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            <div ref={containerRef} className="h-[420px] rounded-xl overflow-hidden border border-border" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
