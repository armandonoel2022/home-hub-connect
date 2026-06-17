// Generador de fichas imprimibles (Vigilante y Puesto).
// Abre una ventana nueva con HTML estilizado y dispara la impresión / PDF.
// Las fotos se resuelven contra el servidor local cuando son rutas /photos.

import type { ArmedPersonnel } from "@/lib/types";
import { displayCaliber } from "@/lib/expedienteHelpers";
import type { DerivedPost } from "@/lib/derivedPosts";
import { getFileUrl } from "@/lib/api";

const LETTERHEAD = "/safeone-letterhead.png";

function esc(v: unknown): string {
  return String(v ?? "—").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

function resolvePhoto(url?: string): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  if (url.startsWith("/")) return getFileUrl(url);
  return url;
}

function row(label: string, value: unknown): string {
  return `<div class="cell"><span class="lbl">${esc(label)}</span><span class="val">${esc(value)}</span></div>`;
}

const baseStyles = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; }
  .head { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #b8860b; padding-bottom: 12px; margin-bottom: 20px; }
  .head img.logo { height: 56px; }
  .head h1 { font-size: 20px; margin: 0; color: #1f2937; }
  .head p { margin: 2px 0 0; font-size: 12px; color: #6b7280; }
  .photos { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .photo { text-align: center; }
  .photo img { width: 150px; height: 150px; object-fit: cover; border: 2px solid #d1d5db; border-radius: 8px; }
  .photo.lic img { width: 240px; height: auto; }
  .photo span { display: block; font-size: 10px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
  .section-title { font-size: 13px; font-weight: 700; color: #b8860b; text-transform: uppercase; letter-spacing: .5px; margin: 18px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cell { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
  .cell .lbl { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; }
  .cell .val { font-size: 13px; font-weight: 600; color: #111827; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  th { background: #1f3a5f; color: #fff; font-size: 11px; text-transform: uppercase; }
  .foot { margin-top: 30px; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } .photo img, .photo.lic img { border-color: #999; } }
`;

function openAndPrint(title: string, body: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Habilita las ventanas emergentes para generar la ficha.");
    return;
  }
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(
    title
  )}</title><style>${baseStyles}</style></head><body>${body}
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
    </body></html>`);
  w.document.close();
}

function header(title: string, subtitle: string): string {
  return `<div class="head">
    <img class="logo" src="${LETTERHEAD}" onerror="this.style.display='none'" />
    <div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
  </div>`;
}

export function printAgentFicha(p: ArmedPersonnel) {
  const photo = resolvePhoto(p.photo);
  const weaponPhoto = resolvePhoto(p.weaponPhoto);
  const licensePhoto = resolvePhoto(p.licensePhoto);

  const body = `
    ${header("Ficha del Vigilante", "SafeOne — Operaciones · Personal Armado")}
    <div class="photos">
      <div class="photo">
        ${photo ? `<img src="${photo}" />` : `<div style="width:150px;height:150px;border:2px dashed #d1d5db;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:11px;">Sin foto</div>`}
        <span>Vigilante</span>
      </div>
      ${weaponPhoto ? `<div class="photo"><img src="${weaponPhoto}" /><span>Arma asignada</span></div>` : ""}
      ${licensePhoto ? `<div class="photo lic"><img src="${licensePhoto}" /><span>Licencia (solo consulta)</span></div>` : ""}
    </div>

    <div class="section-title">Datos del Personal</div>
    <div class="grid">
      ${row("Nombre", p.name)}
      ${row("Código Empleado", p.employeeCode)}
      ${row("Cargo", p.position)}
      ${row("Estado", p.status)}
      ${row("Cel. Empresa", p.fleetPhone)}
      ${row("Cel. Personal", p.personalPhone)}
      ${row("Dirección", p.address)}
      ${row("Supervisor", p.supervisor)}
      ${row("Turno", p.shiftType ? `${p.shiftType} (${p.shiftHours || 12}h)` : "Sin asignar")}
    </div>

    <div class="section-title">Asignación / Puesto</div>
    <div class="grid">
      ${row("Cliente", p.client)}
      ${row("Puesto", p.location)}
      ${row("Provincia", p.province)}
      ${row("Coordenadas", p.coordinates)}
      ${row("Fecha Asignación", p.assignedDate)}
    </div>

    <div class="section-title">Arma y Licencia</div>
    <div class="grid">
      ${row("Tipo de Arma", p.weaponType)}
      ${row("Marca", p.weaponBrand)}
      ${row("Serial", p.weaponSerial)}
      ${row("Tipo Munición", displayCaliber(p.weaponCaliber))}
      ${row("Cápsulas", p.ammunitionCount)}
      ${row("Estado del Arma", p.weaponCondition)}
      ${row("Nro. Licencia", p.licenseNumber)}
      ${row("Vence Licencia", p.licenseExpiry)}
    </div>

    <div class="foot">
      <span>Documento generado por la Intranet SafeOne</span>
      <span>${new Date().toLocaleString("es-DO")}</span>
    </div>`;

  openAndPrint(`Ficha - ${p.name || p.employeeCode}`, body);
}

export function printPostFicha(post: DerivedPost) {
  const agentsRows = post.agents
    .map(
      (a) => `<tr>
        <td>${esc(a.name)}</td>
        <td>${esc(a.employeeCode)}</td>
        <td>${esc(a.position || "Vigilante")}</td>
        <td>${esc(a.shiftType ? `${a.shiftType} (${a.shiftHours || 12}h)` : "—")}</td>
        <td>${esc(a.fleetPhone || a.personalPhone)}</td>
      </tr>`
    )
    .join("");

  const weaponsRows = post.weapons
    .map(
      (w) => `<tr>
        <td>${esc(w.arma)}</td>
        <td>${esc(w.marca)}</td>
        <td>${esc(w.serial)}</td>
        <td>${esc(w.caliber)}</td>
        <td>${esc(w.capsulas ?? 0)}</td>
        <td>${esc(w.agentName)}</td>
        <td>${esc(w.estatus)}</td>
      </tr>`
    )
    .join("");

  const body = `
    ${header("Ficha del Puesto", "SafeOne — Operaciones · Puesto de Trabajo")}
    <div class="section-title">Datos del Puesto</div>
    <div class="grid">
      ${row("Cliente", post.cliente)}
      ${row("Puesto", post.nombre)}
      ${row("Provincia", post.provincia)}
      ${row("Coordenadas", post.coordenada)}
      ${row("Supervisor", post.supervisorName)}
      ${row("Gerencia de Operaciones", post.gerenteOperaciones)}
      ${row("Total Agentes", post.agents.length)}
      ${row("Total Armas", post.weapons.length)}
    </div>

    <div class="section-title">Agentes Asignados (${post.agents.length})</div>
    ${
      post.agents.length
        ? `<table><thead><tr><th>Nombre</th><th>Código</th><th>Cargo</th><th>Turno</th><th>Teléfono</th></tr></thead><tbody>${agentsRows}</tbody></table>`
        : `<p style="font-size:12px;color:#6b7280;">Puesto sin agentes asignados.</p>`
    }

    <div class="section-title">Armas en Custodia (${post.weapons.length})</div>
    ${
      post.weapons.length
        ? `<table><thead><tr><th>Arma</th><th>Marca</th><th>Serial</th><th>Munición</th><th>Cáps.</th><th>Custodia</th><th>Estado</th></tr></thead><tbody>${weaponsRows}</tbody></table>`
        : `<p style="font-size:12px;color:#6b7280;">Sin armas registradas.</p>`
    }

    <div class="foot">
      <span>Documento generado por la Intranet SafeOne</span>
      <span>${new Date().toLocaleString("es-DO")}</span>
    </div>`;

  openAndPrint(`Ficha Puesto - ${post.cliente} / ${post.nombre}`, body);
}
