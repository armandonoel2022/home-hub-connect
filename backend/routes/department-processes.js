const express = require('express');
const router = express.Router();
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILENAME = 'department-processes.json';

// Seed data on first access
function ensureSeedData() {
  let data = readData(FILENAME);
  if (data.length > 0) return data;

  const seed = [
    // ═══ RRHH ═══
    { department: "Recursos Humanos", name: "Ingreso- salida de TSS", objective: "Gestionar altas y bajas en TSS", criticality: 4, checklist: [] },
    { department: "Recursos Humanos", name: "Cargo y Descargo Uniformes, Carnet, Equipos", objective: "Control de activos asignados al personal", criticality: 5, checklist: [] },
    { department: "Recursos Humanos", name: "Digitación y Fiscalización de Comidas", objective: "Control de alimentación del personal", criticality: 5, checklist: [] },
    { department: "Recursos Humanos", name: "Proceso Sisalril - personal licencia", objective: "Gestión de licencias médicas", criticality: 3, checklist: [] },
    { department: "Recursos Humanos", name: "Solicitudes de préstamos", objective: "Gestión de préstamos a colaboradores", criticality: 5, checklist: [] },
    { department: "Recursos Humanos", name: "Solicitud de pago y disfrute de vacaciones", objective: "Gestión de vacaciones", criticality: 4, checklist: [] },
    { department: "Recursos Humanos", name: "Proceso de novedades de nómina", objective: "Gestión de cambios en nómina", criticality: 5, checklist: [] },
    { department: "Recursos Humanos", name: "Proceso plan de salud y seguridad", objective: "Gestión de salud ocupacional", criticality: 2, checklist: [] },
    { department: "Recursos Humanos", name: "Proceso de entrega de prestaciones", objective: "Liquidación de prestaciones laborales", criticality: 3, checklist: [] },
    { department: "Recursos Humanos", name: "Negociación de Mutuo Acuerdo", objective: "Negociación de terminación laboral", criticality: 4, checklist: [] },
    { department: "Recursos Humanos", name: "Generación de Nómina", objective: "Procesamiento de nómina quincenal/mensual", criticality: 4, checklist: [] },
    { department: "Recursos Humanos", name: "Coordinación del Comité Mixto de Seguridad y Salud en el Trabajo", objective: "Garantizar el cumplimiento de la normativa de seguridad y salud laboral", criticality: 5, checklist: [] },

    // ═══ COMERCIAL ═══
    { department: "Gerencia Comercial", name: "Prospección y Generación de Oportunidades", objective: "Identificar y calificar clientes potenciales", criticality: 5, checklist: [] },
    { department: "Gerencia Comercial", name: "Levantamiento de Necesidades del Cliente", objective: "Evaluar en sitio las necesidades del prospecto", criticality: 4, checklist: [] },
    { department: "Gerencia Comercial", name: "Elaboración de Propuestas Comerciales", objective: "Preparar propuestas personalizadas", criticality: 4, checklist: [] },
    { department: "Gerencia Comercial", name: "Seguimiento a Oportunidades de Venta", objective: "Dar seguimiento a propuestas enviadas y avanzar hacia el cierre", criticality: 5, checklist: [] },
    { department: "Gerencia Comercial", name: "Negociación y Cierre de Contratos", objective: "Negociar condiciones comerciales y formalizar contratos", criticality: 5, checklist: [] },
    { department: "Gerencia Comercial", name: "Gestión Documental Comercial", objective: "Administrar contratos, propuestas y documentación comercial", criticality: 5, checklist: [] },
    { department: "Gerencia Comercial", name: "Onboarding de Nuevos Clientes", objective: "Coordinar el inicio del servicio con el departamento correspondiente", criticality: 4, checklist: [] },
    { department: "Gerencia Comercial", name: "Gestión de la Relación con el Cliente", objective: "Mantener comunicación periódica con clientes activos", criticality: 3, checklist: [] },
    { department: "Gerencia Comercial", name: "Gestión de Quejas y Reclamaciones Comerciales", objective: "Atender y resolver quejas del cliente", criticality: 5, checklist: [] },
    { department: "Gerencia Comercial", name: "Gestión de Licitaciones", objective: "Preparar y presentar documentación para licitaciones", criticality: 3, checklist: [] },

    // ═══ ADMINISTRACIÓN ═══
    { department: "Administración", name: "Emisión y envío de facturas a clientes", objective: "Garantizar la emisión y envío oportuno de facturas", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión de cobros a clientes", objective: "Garantizar la recuperación oportuna de cuentas por cobrar", criticality: 5, checklist: [] },
    { department: "Administración", name: "Seguimiento de cuentas por cobrar", objective: "Monitorear facturas pendientes o vencidas", criticality: 5, checklist: [] },
    { department: "Administración", name: "Registro y aplicación de pagos recibidos", objective: "Registrar correctamente los pagos y aplicarlos a facturas", criticality: 5, checklist: [] },
    { department: "Administración", name: "Control y manejo de caja chica", objective: "Garantizar el uso adecuado y control de fondos de caja chica", criticality: 3, checklist: [] },
    { department: "Administración", name: "Registro contable de operaciones", objective: "Garantizar registro oportuno de operaciones financieras", criticality: 5, checklist: [] },
    { department: "Administración", name: "Conciliación de cuentas por cobrar", objective: "Verificar que pagos coincidan con registros contables", criticality: 3, checklist: [] },
    { department: "Administración", name: "Emisión de notas de crédito o ajustes", objective: "Corregir errores de facturación o ajustes autorizados", criticality: 3, checklist: [] },
    { department: "Administración", name: "Preparación y presentación de impuestos (IR-3, IR-17, IT-1)", objective: "Cumplimiento de obligaciones fiscales", criticality: 5, checklist: [] },
    { department: "Administración", name: "Planificación financiera y control de flujo de caja", objective: "Planificar y controlar ingresos y egresos", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión de Activos Fijos", objective: "Registro, control y administración de activos fijos", criticality: 3, checklist: [] },
    { department: "Administración", name: "Gestión de pago de nómina", objective: "Procesar el pago oportuno a colaboradores", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión de pago vacaciones", objective: "Pago de vacaciones cumpliendo normativa laboral", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión de pago a proveedores", objective: "Garantizar el pago oportuno a proveedores", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión de compras y contrataciones", objective: "Adquisición eficiente de bienes y servicios", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión de debida diligencia a proveedores", objective: "Verificar cumplimiento legal de proveedores", criticality: 5, checklist: [] },
    { department: "Administración", name: "Control documental de flotilla vehicular", objective: "Conservación de documentación vehicular", criticality: 4, checklist: [] },
    { department: "Administración", name: "Gestión de pagos a TSS, INFOTEP y DGII", objective: "Cumplimiento de obligaciones con organismos", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión de documentaciones normativas y seguros", objective: "Documentos y pólizas vigentes y renovados", criticality: 5, checklist: [] },
    { department: "Administración", name: "Administración de tarjetas de combustible Venergy", objective: "Control y trazabilidad de tarjetas de combustible", criticality: 5, checklist: [] },
    { department: "Administración", name: "Gestión bancaria", objective: "Administración de relaciones bancarias", criticality: 5, checklist: [] },
    { department: "Administración", name: "Administración y control de llaves", objective: "Control de llaves y dispositivos de acceso", criticality: 3, checklist: [] },
    { department: "Administración", name: "Gestión de conserjería y servicios generales", objective: "Operación eficiente de servicios generales", criticality: 3, checklist: [] },

    // ═══ TECNOLOGÍA Y MONITOREO ═══
    { department: "Tecnología y Monitoreo", name: "Recepción y Procesamiento de Señales de Alarma", objective: "Recibir, clasificar y procesar señales de alarma en tiempo real", criticality: 5, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Verificación y Validación de Eventos", objective: "Confirmar si una señal es un evento real de seguridad", criticality: 5, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Alta y Baja de Cuentas de Monitoreo", objective: "Gestionar activación y desactivación de cuentas", criticality: 4, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Monitoreo de Salud de Sistemas Remotos", objective: "Supervisar conectividad y funcionamiento de paneles", criticality: 4, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Registro y Documentación de Eventos", objective: "Documentar cada evento procesado", criticality: 3, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Administración de Servidores y Plataformas", objective: "Garantizar disponibilidad y seguridad de servidores", criticality: 5, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Gestión de Red y Conectividad", objective: "Administrar infraestructura de red", criticality: 5, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Respaldo y Recuperación de Datos", objective: "Ejecutar copias de seguridad periódicas", criticality: 5, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Gestión de Seguridad Informática", objective: "Proteger contra amenazas cibernéticas", criticality: 4, checklist: [] },
    { department: "Tecnología y Monitoreo", name: "Gestión de Licenciamiento y Software", objective: "Controlar licencias y gestionar renovaciones", criticality: 3, checklist: [] },

    // ═══ SEGURIDAD ELECTRÓNICA ═══
    { department: "Seguridad Electrónica", name: "Diseño de Soluciones de Seguridad Electrónica", objective: "Levantamiento técnico y diseño de soluciones", criticality: 4, checklist: [] },
    { department: "Seguridad Electrónica", name: "Instalación y Configuración de Sistemas", objective: "Instalación física y configuración de CCTV, alarmas y acceso", criticality: 4, checklist: [] },
    { department: "Seguridad Electrónica", name: "Entrega y Aceptación de Proyectos", objective: "Formalizar la entrega con pruebas y documentación", criticality: 4, checklist: [] },
    { department: "Seguridad Electrónica", name: "Gestión de Inventario de Equipos", objective: "Controlar inventario de equipos de seguridad electrónica", criticality: 3, checklist: [] },
    { department: "Seguridad Electrónica", name: "Atención de Solicitudes de Soporte Técnico", objective: "Recibir, clasificar y resolver solicitudes de soporte", criticality: 4, checklist: [] },
    { department: "Seguridad Electrónica", name: "Mantenimiento Preventivo de Sistemas", objective: "Ejecutar mantenimientos programados en clientes", criticality: 4, checklist: [] },
    { department: "Seguridad Electrónica", name: "Mantenimiento Correctivo de Sistemas", objective: "Diagnosticar y reparar fallas reportadas", criticality: 4, checklist: [] },
    { department: "Seguridad Electrónica", name: "Mantenimiento de Infraestructura del Centro de Monitoreo", objective: "Mantenimiento periódico de servidores, UPS y red", criticality: 5, checklist: [] },
    { department: "Seguridad Electrónica", name: "Planificación y Coordinación de Trabajos Técnicos", objective: "Programar y coordinar trabajos del equipo técnico", criticality: 3, checklist: [] },
    { department: "Seguridad Electrónica", name: "Seguridad Electrónica de la Oficina", objective: "Mantenimiento de seguridad electrónica interna", criticality: 4, checklist: [] },
  ];

  data = seed.map((p, i) => ({
    ...p,
    id: `PROC-${String(i + 1).padStart(3, '0')}`,
    checklist: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  writeData(FILENAME, data);
  return data;
}

// GET all processes (filtered by department for non-admins)
router.get('/', auth, (req, res) => {
  const data = ensureSeedData();
  const { department } = req.query;
  if (department) {
    return res.json(data.filter(p => p.department === department));
  }
  // Admin sees all, others see only their department
  if (req.user?.isAdmin) return res.json(data);
  return res.json(data.filter(p => p.department === req.user?.department));
});

// GET by id
router.get('/:id', auth, (req, res) => {
  const data = ensureSeedData();
  const proc = data.find(p => p.id === req.params.id);
  if (!proc) return res.status(404).json({ message: 'Proceso no encontrado' });
  res.json(proc);
});

// POST create new process (admin/leader only)
router.post('/', auth, (req, res) => {
  if (!req.user?.isAdmin && !req.user?.isDepartmentLeader) {
    return res.status(403).json({ message: 'Solo admin o líder puede crear procesos' });
  }
  const data = ensureSeedData();
  const newProc = {
    ...req.body,
    id: generateId('PROC', data),
    checklist: req.body.checklist || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.push(newProc);
  writeData(FILENAME, data);
  res.status(201).json(newProc);
});

// PUT update process (admin/leader only)
router.put('/:id', auth, (req, res) => {
  if (!req.user?.isAdmin && !req.user?.isDepartmentLeader) {
    return res.status(403).json({ message: 'Solo admin o líder puede editar procesos' });
  }
  const data = ensureSeedData();
  const idx = data.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Proceso no encontrado' });
  data[idx] = { ...data[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeData(FILENAME, data);
  res.json(data[idx]);
});

// DELETE process (admin only)
router.delete('/:id', auth, (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Solo admin puede eliminar procesos' });
  }
  const data = ensureSeedData();
  const idx = data.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Proceso no encontrado' });
  data.splice(idx, 1);
  writeData(FILENAME, data);
  res.status(204).send();
});

// PUT update checklist for a process
router.put('/:id/checklist', auth, (req, res) => {
  if (!req.user?.isAdmin && !req.user?.isDepartmentLeader) {
    return res.status(403).json({ message: 'Solo admin o líder puede editar checklist' });
  }
  const data = ensureSeedData();
  const idx = data.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Proceso no encontrado' });
  data[idx].checklist = req.body.checklist || [];
  data[idx].updatedAt = new Date().toISOString();
  writeData(FILENAME, data);
  res.json(data[idx]);
});

module.exports = router;
