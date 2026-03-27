import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { ArmedPersonnel } from "@/lib/types";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function parseCoords(coord?: string): [number, number] | null {
  if (!coord) return null;
  const parts = coord.split(",").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
  return null;
}

export default function PersonnelMapView({ personnel }: { personnel: ArmedPersonnel[] }) {
  const center = parseCoords(personnel[0]?.coordinates) || [18.5, -69.9];

  return (
    <div className="h-[500px] rounded-xl overflow-hidden border border-border">
      <MapContainer center={center} zoom={9} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {personnel.map(p => {
          const pos = parseCoords(p.coordinates)!;
          const condIcon = p.weaponCondition?.includes("buenas") || p.weaponCondition === "En condiciones" ? "🟢" : p.weaponCondition?.includes("mantenimiento") ? "🟡" : "🔴";
          return (
            <Marker key={p.id} position={pos}>
              <Popup>
                <div className="text-xs min-w-[180px]">
                  <p className="font-bold text-sm">{condIcon} {p.name || "Sin nombre"}</p>
                  <p><strong>Código:</strong> {p.employeeCode}</p>
                  <p><strong>Cliente:</strong> {p.client}</p>
                  <p><strong>Puesto:</strong> {p.location}</p>
                  <p><strong>Provincia:</strong> {p.province}</p>
                  <p><strong>Arma:</strong> {p.weaponType} {p.weaponBrand}</p>
                  <p><strong>Serial:</strong> {p.weaponSerial}</p>
                  <p><strong>Estado:</strong> {p.weaponCondition}</p>
                  <a href={`https://www.google.com/maps?q=${p.coordinates}`} target="_blank" rel="noopener" className="text-blue-600 underline block mt-1">Abrir en Google Maps</a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
