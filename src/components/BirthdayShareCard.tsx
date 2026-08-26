import { forwardRef } from "react";
import { getFileUrl } from "@/lib/api";
import type { IntranetUser } from "@/lib/types";

function resolvePhoto(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/photos") || url.startsWith("/uploads")) return getFileUrl(url);
  return url;
}

/**
 * Tarjeta de felicitación en formato vertical 9:16 (1080x1920) pensada para
 * descargarse y compartirse por celular / historias de WhatsApp.
 * Se renderiza fuera de pantalla y se captura con html2canvas.
 */
interface Props {
  people: IntranetUser[];
}

const GOLD = "#FFC800";
const GOLD_SOFT = "#FFD966";
const INK = "#14181F";
const INK_SOFT = "#1E242E";

const BirthdayShareCard = forwardRef<HTMLDivElement, Props>(({ people }, ref) => {
  const single = people.length === 1 ? people[0] : null;
  const today = new Date().toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        width: 1080,
        height: 1920,
        background: `radial-gradient(1200px 900px at 50% 8%, ${INK_SOFT} 0%, ${INK} 62%, #0B0E13 100%)`,
        fontFamily: "'Open Sans', sans-serif",
        overflow: "hidden",
        color: "#FFFFFF",
      }}
    >
      {/* Marco dorado */}
      <div style={{ position: "absolute", inset: 36, border: `2px solid ${GOLD}33`, borderRadius: 48 }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT}, ${GOLD})` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 14, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT}, ${GOLD})` }} />

      {/* Halos */}
      <div style={{ position: "absolute", top: -180, left: -160, width: 620, height: 620, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}22 0%, transparent 70%)` }} />
      <div style={{ position: "absolute", bottom: -220, right: -180, width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}1A 0%, transparent 70%)` }} />

      {/* Confeti geométrico */}
      {Array.from({ length: 46 }).map((_, i) => {
        const seed = (i * 9301 + 49297) % 233280;
        const r = seed / 233280;
        const r2 = ((i * 4517 + 1231) % 977) / 977;
        const size = 8 + Math.round(r2 * 16);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${Math.round(r * 96) + 2}%`,
              top: `${Math.round(r2 * 92) + 3}%`,
              width: size,
              height: i % 3 === 0 ? size : Math.round(size / 2.4),
              borderRadius: i % 3 === 0 ? "50%" : 3,
              background: i % 4 === 0 ? "#FFFFFF" : GOLD,
              opacity: i % 3 === 0 ? 0.35 : 0.22,
              transform: `rotate(${Math.round(r * 180)}deg)`,
            }}
          />
        );
      })}

      {/* Contenido */}
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 96px",
          textAlign: "center",
        }}
      >
        <div style={{ letterSpacing: 12, fontSize: 26, color: GOLD, fontWeight: 700, marginBottom: 28 }}>
          SAFEONE SECURITY
        </div>

        <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 24 }}>🎂</div>

        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: single ? 104 : 88,
            fontWeight: 900,
            lineHeight: 1.08,
            margin: 0,
            color: GOLD,
            textShadow: `0 6px 30px ${GOLD}55, 0 2px 0 #B8860B`,
          }}
        >
          ¡Feliz
          <br />
          Cumpleaños!
        </h1>

        <div style={{ width: 140, height: 5, background: GOLD, borderRadius: 999, margin: "40px 0 56px" }} />

        {single ? (
          <>
            <div
              style={{
                width: 420,
                height: 420,
                borderRadius: "50%",
                border: `8px solid ${GOLD}`,
                boxShadow: `0 0 0 18px ${GOLD}14`,
                overflow: "hidden",
                background: INK_SOFT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 56,
              }}
            >
              {single.photoUrl ? (
                <img
                  src={resolvePhoto(single.photoUrl)}
                  alt={single.fullName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  crossOrigin="anonymous"
                />
              ) : (
                <span style={{ fontSize: 160 }}>🎉</span>
              )}
            </div>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 72, fontWeight: 800, margin: 0, color: "#FFFFFF" }}>
              {single.fullName}
            </h2>
            <p style={{ fontSize: 34, color: GOLD_SOFT, marginTop: 18, marginBottom: 0, fontWeight: 600 }}>
              {single.position}
            </p>
            <p style={{ fontSize: 30, color: "#FFFFFF99", marginTop: 8 }}>{single.department}</p>
          </>
        ) : (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 28, marginBottom: 24 }}>
            {people.slice(0, 6).map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 32,
                  background: "#FFFFFF0D",
                  border: `1px solid ${GOLD}33`,
                  borderRadius: 32,
                  padding: "26px 34px",
                  textAlign: "left",
                }}
              >
                <div style={{ width: 132, height: 132, borderRadius: "50%", overflow: "hidden", border: `4px solid ${GOLD}`, background: INK_SOFT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {u.photoUrl ? (
                    <img src={resolvePhoto(u.photoUrl)} alt={u.fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
                  ) : (
                    <span style={{ fontSize: 56 }}>🎉</span>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 46, fontWeight: 800 }}>{u.fullName}</div>
                  <div style={{ fontSize: 28, color: GOLD_SOFT, marginTop: 6 }}>{u.position}</div>
                  <div style={{ fontSize: 26, color: "#FFFFFF99" }}>{u.department}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p
          style={{
            fontSize: 34,
            lineHeight: 1.5,
            color: "#FFFFFFCC",
            fontStyle: "italic",
            marginTop: 64,
            maxWidth: 780,
          }}
        >
          SafeOne Security Company te desea un maravilloso día lleno de éxitos y bendiciones.
        </p>

        <div style={{ position: "absolute", bottom: 96, left: 0, right: 0, fontSize: 24, letterSpacing: 6, color: `${GOLD}CC`, textTransform: "uppercase" }}>
          {today}
        </div>
      </div>
    </div>
  );
});

BirthdayShareCard.displayName = "BirthdayShareCard";

export default BirthdayShareCard;
