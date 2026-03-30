import type { ChecklistItem } from "@/pages/DepartmentProcesses";

export interface ProcessSeed {
  id: string;
  department: string;
  name: string;
  objective: string;
  criticality: number;
  checklist: ChecklistItem[];
}

let counter = 0;
const mkId = () => `PROC-${String(++counter).padStart(3, '0')}`;
const mk = (department: string, name: string, objective: string, criticality: number): ProcessSeed => ({
  id: mkId(), department, name, objective, criticality, checklist: [],
});

export const SEED_PROCESSES: ProcessSeed[] = [
  // ═══ RRHH ═══
  mk("Recursos Humanos", "Ingreso- salida de TSS", "Gestionar altas y bajas en TSS", 4),
  mk("Recursos Humanos", "Cargo y Descargo Uniformes, Carnet, Equipos", "Control de activos asignados al personal", 5),
  mk("Recursos Humanos", "Digitación y Fiscalización de Comidas", "Control de alimentación del personal", 5),
  mk("Recursos Humanos", "Proceso Sisalril - personal licencia", "Gestión de licencias médicas", 3),
  mk("Recursos Humanos", "Solicitudes de préstamos", "Gestión de préstamos a colaboradores", 5),
  mk("Recursos Humanos", "Solicitud de pago y disfrute de vacaciones", "Gestión de vacaciones", 4),
  mk("Recursos Humanos", "Proceso de novedades de nómina", "Gestión de cambios en nómina", 5),
  mk("Recursos Humanos", "Proceso plan de salud y seguridad", "Gestión de salud ocupacional", 2),
  mk("Recursos Humanos", "Proceso de entrega de prestaciones", "Liquidación de prestaciones laborales", 3),
  mk("Recursos Humanos", "Negociación de Mutuo Acuerdo", "Negociación de terminación laboral", 4),
  mk("Recursos Humanos", "Generación de Nómina", "Procesamiento de nómina quincenal/mensual", 4),
  mk("Recursos Humanos", "Coordinación del Comité Mixto de Seguridad y Salud en el Trabajo", "Garantizar el cumplimiento de la normativa de seguridad y salud laboral", 5),

  // ═══ COMERCIAL ═══
  mk("Gerencia Comercial", "Prospección y Generación de Oportunidades", "Identificar y calificar clientes potenciales", 5),
  mk("Gerencia Comercial", "Levantamiento de Necesidades del Cliente", "Evaluar en sitio las necesidades del prospecto", 4),
  mk("Gerencia Comercial", "Elaboración de Propuestas Comerciales", "Preparar propuestas personalizadas", 4),
  mk("Gerencia Comercial", "Seguimiento a Oportunidades de Venta", "Dar seguimiento a propuestas enviadas y avanzar hacia el cierre", 5),
  mk("Gerencia Comercial", "Negociación y Cierre de Contratos", "Negociar condiciones comerciales y formalizar contratos", 5),
  mk("Gerencia Comercial", "Gestión Documental Comercial", "Administrar contratos, propuestas y documentación comercial", 5),
  mk("Gerencia Comercial", "Onboarding de Nuevos Clientes", "Coordinar el inicio del servicio con el departamento correspondiente", 4),
  mk("Gerencia Comercial", "Gestión de la Relación con el Cliente", "Mantener comunicación periódica con clientes activos", 3),
  mk("Gerencia Comercial", "Gestión de Quejas y Reclamaciones Comerciales", "Atender y resolver quejas del cliente", 5),
  mk("Gerencia Comercial", "Gestión de Licitaciones", "Preparar y presentar documentación para licitaciones", 3),

  // ═══ ADMINISTRACIÓN ═══
  mk("Administración", "Emisión y envío de facturas a clientes", "Garantizar la emisión y envío oportuno de facturas", 5),
  mk("Administración", "Gestión de cobros a clientes", "Garantizar la recuperación oportuna de cuentas por cobrar", 5),
  mk("Administración", "Seguimiento de cuentas por cobrar", "Monitorear facturas pendientes o vencidas", 5),
  mk("Administración", "Registro y aplicación de pagos recibidos", "Registrar correctamente los pagos y aplicarlos a facturas", 5),
  mk("Administración", "Control y manejo de caja chica", "Garantizar el uso adecuado y control de fondos de caja chica", 3),
  mk("Administración", "Registro contable de operaciones", "Garantizar registro oportuno de operaciones financieras", 5),
  mk("Administración", "Conciliación de cuentas por cobrar", "Verificar que pagos coincidan con registros contables", 3),
  mk("Administración", "Emisión de notas de crédito o ajustes", "Corregir errores de facturación o ajustes autorizados", 3),
  mk("Administración", "Preparación y presentación de impuestos (IR-3, IR-17, IT-1)", "Cumplimiento de obligaciones fiscales", 5),
  mk("Administración", "Planificación financiera y control de flujo de caja", "Planificar y controlar ingresos y egresos", 5),
  mk("Administración", "Gestión de Activos Fijos", "Registro, control y administración de activos fijos", 3),
  mk("Administración", "Gestión de pago de nómina", "Procesar el pago oportuno a colaboradores", 5),
  mk("Administración", "Gestión de pago vacaciones", "Pago de vacaciones cumpliendo normativa laboral", 5),
  mk("Administración", "Gestión de pago a proveedores", "Garantizar el pago oportuno a proveedores", 5),
  mk("Administración", "Gestión de compras y contrataciones", "Adquisición eficiente de bienes y servicios", 5),
  mk("Administración", "Gestión de debida diligencia a proveedores", "Verificar cumplimiento legal de proveedores", 5),
  mk("Administración", "Control documental de flotilla vehicular", "Conservación de documentación vehicular", 4),
  mk("Administración", "Gestión de pagos a TSS, INFOTEP y DGII", "Cumplimiento de obligaciones con organismos", 5),
  mk("Administración", "Gestión de documentaciones normativas y seguros", "Documentos y pólizas vigentes y renovados", 5),
  mk("Administración", "Administración de tarjetas de combustible Venergy", "Control y trazabilidad de tarjetas de combustible", 5),
  mk("Administración", "Gestión bancaria", "Administración de relaciones bancarias", 5),
  mk("Administración", "Administración y control de llaves", "Control de llaves y dispositivos de acceso", 3),
  mk("Administración", "Gestión de conserjería y servicios generales", "Operación eficiente de servicios generales", 3),

  // ═══ TECNOLOGÍA Y MONITOREO ═══
  mk("Tecnología y Monitoreo", "Recepción y Procesamiento de Señales de Alarma", "Recibir, clasificar y procesar señales de alarma en tiempo real", 5),
  mk("Tecnología y Monitoreo", "Verificación y Validación de Eventos", "Confirmar si una señal es un evento real de seguridad", 5),
  mk("Tecnología y Monitoreo", "Alta y Baja de Cuentas de Monitoreo", "Gestionar activación y desactivación de cuentas", 4),
  mk("Tecnología y Monitoreo", "Monitoreo de Salud de Sistemas Remotos", "Supervisar conectividad y funcionamiento de paneles", 4),
  mk("Tecnología y Monitoreo", "Registro y Documentación de Eventos", "Documentar cada evento procesado", 3),
  mk("Tecnología y Monitoreo", "Administración de Servidores y Plataformas", "Garantizar disponibilidad y seguridad de servidores", 5),
  mk("Tecnología y Monitoreo", "Gestión de Red y Conectividad", "Administrar infraestructura de red", 5),
  mk("Tecnología y Monitoreo", "Respaldo y Recuperación de Datos", "Ejecutar copias de seguridad periódicas", 5),
  mk("Tecnología y Monitoreo", "Gestión de Seguridad Informática", "Proteger contra amenazas cibernéticas", 4),
  mk("Tecnología y Monitoreo", "Gestión de Licenciamiento y Software", "Controlar licencias y gestionar renovaciones", 3),

  // ═══ SEGURIDAD ELECTRÓNICA ═══
  mk("Seguridad Electrónica", "Diseño de Soluciones de Seguridad Electrónica", "Levantamiento técnico y diseño de soluciones", 4),
  mk("Seguridad Electrónica", "Instalación y Configuración de Sistemas", "Instalación física y configuración de CCTV, alarmas y acceso", 4),
  mk("Seguridad Electrónica", "Entrega y Aceptación de Proyectos", "Formalizar la entrega con pruebas y documentación", 4),
  mk("Seguridad Electrónica", "Gestión de Inventario de Equipos", "Controlar inventario de equipos de seguridad electrónica", 3),
  mk("Seguridad Electrónica", "Atención de Solicitudes de Soporte Técnico", "Recibir, clasificar y resolver solicitudes de soporte", 4),
  mk("Seguridad Electrónica", "Mantenimiento Preventivo de Sistemas", "Ejecutar mantenimientos programados en clientes", 4),
  mk("Seguridad Electrónica", "Mantenimiento Correctivo de Sistemas", "Diagnosticar y reparar fallas reportadas", 4),
  mk("Seguridad Electrónica", "Mantenimiento de Infraestructura del Centro de Monitoreo", "Mantenimiento periódico de servidores, UPS y red", 5),
  mk("Seguridad Electrónica", "Planificación y Coordinación de Trabajos Técnicos", "Programar y coordinar trabajos del equipo técnico", 3),
  mk("Seguridad Electrónica", "Seguridad Electrónica de la Oficina", "Mantenimiento de seguridad electrónica interna", 4),
];
