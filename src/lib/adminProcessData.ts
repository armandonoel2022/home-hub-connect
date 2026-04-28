export interface AdminChecklistItem {
  id: string;
  text: string;
}

export interface AdminProcess {
  id: string;
  category: string;
  name: string;
  checklist: AdminChecklistItem[];
}

export interface AdminActivityEntry {
  id: string;
  processId: string;
  checklistItemId?: string;
  note: string;
  completedBy: string;
  completedAt: string;
  status: "pendiente" | "en-proceso" | "completado";
}

export const ADMIN_CATEGORIES = [
  { key: "facturacion", label: "Facturación y Cobros", icon: "Receipt", color: "hsl(142 70% 45%)" },
  { key: "tesoreria", label: "Tesorería y Pagos", icon: "Banknote", color: "hsl(220 70% 50%)" },
  { key: "contabilidad", label: "Contabilidad y Fiscal", icon: "Calculator", color: "hsl(280 60% 50%)" },
  { key: "compras", label: "Compras y Proveedores", icon: "ShoppingCart", color: "hsl(42 100% 50%)" },
  { key: "activos", label: "Activos y Flotilla", icon: "Package", color: "hsl(15 80% 50%)" },
  { key: "documentacion", label: "Documentación y Servicios", icon: "FolderOpen", color: "hsl(200 60% 50%)" },
] as const;

let _id = 0;
const id = () => `AP-${String(++_id).padStart(3, "0")}`;
let _ci = 0;
const ci = (text: string): AdminChecklistItem => ({ id: `CI-${String(++_ci).padStart(4, "0")}`, text });

export const ADMIN_PROCESSES: AdminProcess[] = [
  // ── Facturación y Cobros ──
  {
    id: id(), category: "facturacion", name: "Emisión y envío de facturas a clientes",
    checklist: [
      ci("Validar servicios prestados vs contrato"),
      ci("Generar factura en sistema contable"),
      ci("Asignar NCF correspondiente"),
      ci("Verificar datos fiscales del cliente"),
      ci("Enviar factura por correo o plataforma acordada"),
      ci("Registrar envío y acuse de recibo"),
    ],
  },
  {
    id: id(), category: "facturacion", name: "Gestión de cobros a clientes",
    checklist: [
      ci("Identificar facturas vencidas y por vencer"),
      ci("Contactar clientes (correo, llamada, WhatsApp)"),
      ci("Negociar compromisos de pago"),
      ci("Registrar promesas de pago"),
      ci("Escalar cuentas críticas"),
      ci("Dar seguimiento hasta recuperación"),
    ],
  },
  {
    id: id(), category: "facturacion", name: "Seguimiento de cuentas por cobrar",
    checklist: [
      ci("Generar reporte de antigüedad de saldos"),
      ci("Clasificar cuentas (corrientes, vencidas, incobrables)"),
      ci("Actualizar estado de cada cliente"),
      ci("Preparar informes para gerencia"),
      ci("Identificar riesgos de morosidad"),
    ],
  },
  {
    id: id(), category: "facturacion", name: "Registro y aplicación de pagos recibidos",
    checklist: [
      ci("Verificar ingresos en banco"),
      ci("Identificar cliente y factura correspondiente"),
      ci("Registrar pago en sistema"),
      ci("Aplicar pago a facturas específicas"),
      ci("Generar recibo de pago"),
      ci("Archivar soporte"),
    ],
  },
  {
    id: id(), category: "facturacion", name: "Conciliación de cuentas por cobrar",
    checklist: [
      ci("Comparar registros contables vs banco"),
      ci("Identificar diferencias"),
      ci("Investigar inconsistencias"),
      ci("Ajustar registros si aplica"),
      ci("Documentar conciliación"),
    ],
  },
  {
    id: id(), category: "facturacion", name: "Emisión de notas de crédito",
    checklist: [
      ci("Recibir solicitud de ajuste"),
      ci("Validar aprobación"),
      ci("Generar nota de crédito"),
      ci("Aplicar ajuste a factura"),
      ci("Notificar al cliente"),
      ci("Registrar contablemente"),
    ],
  },

  // ── Tesorería y Pagos ──
  {
    id: id(), category: "tesoreria", name: "Pago de nómina",
    checklist: [
      ci("Recibir novedades de RRHH"),
      ci("Calcular salarios y deducciones"),
      ci("Generar archivo de pago"),
      ci("Validar montos"),
      ci("Ejecutar pagos (transferencias/efectivo)"),
      ci("Generar comprobantes"),
    ],
  },
  {
    id: id(), category: "tesoreria", name: "Pago de vacaciones",
    checklist: [
      ci("Validar solicitud aprobada"),
      ci("Calcular monto correspondiente"),
      ci("Procesar pago"),
      ci("Registrar contablemente"),
      ci("Notificar al colaborador"),
    ],
  },
  {
    id: id(), category: "tesoreria", name: "Pago a proveedores",
    checklist: [
      ci("Recibir factura del proveedor"),
      ci("Validar contra orden de compra"),
      ci("Programar pago"),
      ci("Ejecutar pago (transferencia/cheque)"),
      ci("Registrar en sistema"),
      ci("Archivar soporte"),
    ],
  },
  {
    id: id(), category: "tesoreria", name: "Pagos a TSS, INFOTEP y DGII",
    checklist: [
      ci("Generar cálculos de aportes"),
      ci("Validar nómina reportada"),
      ci("Acceder plataformas oficiales"),
      ci("Realizar pagos"),
      ci("Descargar comprobantes"),
      ci("Archivar soporte"),
    ],
  },

  // ── Contabilidad y Fiscal ──
  {
    id: id(), category: "contabilidad", name: "Registro contable de operaciones",
    checklist: [
      ci("Recibir documentos (facturas, recibos, etc.)"),
      ci("Clasificar transacciones"),
      ci("Registrar en sistema contable"),
      ci("Validar cuentas contables"),
      ci("Revisar consistencia de registros"),
      ci("Cerrar periodos contables"),
    ],
  },
  {
    id: id(), category: "contabilidad", name: "Declaraciones de impuestos (DGII)",
    checklist: [
      ci("Recopilar información fiscal"),
      ci("Calcular impuestos (ITBIS, ISR, etc.)"),
      ci("Generar formularios (IR-3, IR-17, IT-1)"),
      ci("Validar datos"),
      ci("Presentar en portal DGII"),
      ci("Programar pagos"),
      ci("Archivar acuses"),
    ],
  },
  {
    id: id(), category: "contabilidad", name: "Planificación financiera y flujo de caja",
    checklist: [
      ci("Proyectar ingresos"),
      ci("Estimar egresos"),
      ci("Elaborar flujo de caja"),
      ci("Identificar déficit o excedentes"),
      ci("Proponer acciones financieras"),
      ci("Monitorear ejecución real vs plan"),
    ],
  },

  // ── Compras y Proveedores ──
  {
    id: id(), category: "compras", name: "Control y manejo de caja chica",
    checklist: [
      ci("Asignar fondo inicial"),
      ci("Validar solicitudes de gasto menor"),
      ci("Registrar cada gasto con soporte"),
      ci("Realizar arqueos periódicos"),
      ci("Reponer fondo (reembolso)"),
      ci("Reportar inconsistencias"),
    ],
  },
  {
    id: id(), category: "compras", name: "Gestión de compras y contrataciones",
    checklist: [
      ci("Recibir solicitud interna"),
      ci("Solicitar cotizaciones"),
      ci("Evaluar proveedores"),
      ci("Seleccionar proveedor"),
      ci("Emitir orden de compra"),
      ci("Dar seguimiento a entrega"),
    ],
  },
  {
    id: id(), category: "compras", name: "Debida diligencia a proveedores",
    checklist: [
      ci("Recopilar documentación legal"),
      ci("Validar RNC y cumplimiento fiscal"),
      ci("Evaluar historial financiero"),
      ci("Verificar listas restrictivas"),
      ci("Aprobar o rechazar proveedor"),
      ci("Mantener expediente actualizado"),
    ],
  },

  // ── Activos y Flotilla ──
  {
    id: id(), category: "activos", name: "Gestión de activos fijos",
    checklist: [
      ci("Registrar activos adquiridos"),
      ci("Asignar código y ubicación"),
      ci("Calcular depreciación"),
      ci("Realizar inventarios físicos"),
      ci("Dar de baja activos obsoletos"),
      ci("Mantener historial actualizado"),
    ],
  },
  {
    id: id(), category: "activos", name: "Control documental flotilla vehicular",
    checklist: [
      ci("Registrar vehículos"),
      ci("Archivar matrículas, seguros, marbetes"),
      ci("Monitorear vencimientos"),
      ci("Gestionar renovaciones"),
      ci("Controlar disponibilidad de documentos"),
    ],
  },
  {
    id: id(), category: "activos", name: "Control de tarjetas de combustible",
    checklist: [
      ci("Asignar tarjetas"),
      ci("Monitorear consumo"),
      ci("Validar uso vs rutas"),
      ci("Detectar irregularidades"),
      ci("Generar reportes"),
      ci("Gestionar reposiciones"),
    ],
  },
  {
    id: id(), category: "activos", name: "Gestión bancaria",
    checklist: [
      ci("Solicitar estados de cuenta"),
      ci("Conciliar cuentas bancarias"),
      ci("Gestionar préstamos"),
      ci("Mantener relación con bancos"),
      ci("Preparar documentación financiera"),
    ],
  },
  // Control de llaves se gestiona como acceso destacado en el Hub (módulo dedicado).

  // ── Documentación y Servicios ──
  {
    id: id(), category: "documentacion", name: "Gestión de documentación normativa y seguros",
    checklist: [
      ci("Identificar documentos requeridos"),
      ci("Monitorear fechas de vencimiento"),
      ci("Coordinar renovaciones"),
      ci("Actualizar pólizas"),
      ci("Archivar documentación vigente"),
    ],
  },
  {
    id: id(), category: "documentacion", name: "Servicios generales",
    checklist: [
      ci("Supervisar limpieza"),
      ci("Gestionar mantenimiento de instalaciones"),
      ci("Controlar suministros"),
      ci("Coordinar conserjería"),
      ci("Atender incidencias operativas"),
    ],
  },
];

// ── localStorage helpers ──
const ACTIVITY_KEY = "safeone_admin_activities";

export function getAdminActivities(): AdminActivityEntry[] {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"); } catch { return []; }
}

export function saveAdminActivity(entry: Omit<AdminActivityEntry, "id">): AdminActivityEntry {
  const activities = getAdminActivities();
  const newEntry: AdminActivityEntry = { ...entry, id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  activities.unshift(newEntry);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
  return newEntry;
}

export function deleteAdminActivity(activityId: string) {
  const activities = getAdminActivities().filter(a => a.id !== activityId);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
}

// Checklist completion state per period
const CHECKLIST_KEY = "safeone_admin_checklist_state";

export interface ChecklistState {
  [processId_itemId: string]: { completed: boolean; completedBy: string; completedAt: string };
}

export function getChecklistState(): ChecklistState {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}"); } catch { return {}; }
}

export function toggleChecklistItem(processId: string, itemId: string, userName: string): ChecklistState {
  const state = getChecklistState();
  const key = `${processId}_${itemId}`;
  if (state[key]?.completed) {
    delete state[key];
  } else {
    state[key] = { completed: true, completedBy: userName, completedAt: new Date().toISOString() };
  }
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  return state;
}
