const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

const FILE = 'hr-benefits.json';

const DEFAULT_BENEFITS = [
  {
    id: 'BNF-001',
    title: 'Bono de Referidos',
    icon: 'UserPlus',
    color: 'amber',
    appliesTo: 'Todos los colaboradores',
    summary: 'RD$1,000 por cada persona referida que apruebe su período probatorio de 3 meses.',
    details: [
      'Por cada persona referida que apruebe su período probatorio de 3 meses se le acreditan RD$1,000 pesos.',
      'El colaborador debe informar a Recursos Humanos el candidato referido para que al cumplir el periodo de prueba reciba su compensación.',
    ],
    order: 1,
  },
  {
    id: 'BNF-002',
    title: 'Día de Cumpleaños',
    icon: 'Cake',
    color: 'rose',
    appliesTo: 'Todos los colaboradores',
    summary: 'Día libre por motivo de cumpleaños.',
    details: [
      'Por motivo de su cumpleaños a todos los colaboradores se les otorga el día libre.',
      'No es acumulable con otros días libres o free hours.',
      'Personal cuyo cumpleaños cae fin de semana puede tomar la tarde del viernes.',
      'Este beneficio debe ser controlado por el supervisor del área e informar a Recursos Humanos.',
    ],
    order: 2,
  },
  {
    id: 'BNF-003',
    title: 'Free Hours',
    icon: 'Clock',
    color: 'sky',
    appliesTo: 'Todos los colaboradores',
    summary: '4 horas mensuales para diligencias personales.',
    details: [
      'Todos los colaboradores cuentan con 4 horas al mes para utilizar en diligencias personales.',
      'No son acumulables con otros beneficios ni con los meses siguientes.',
      'No aplica para colaboradores con permisos especiales (ausencias programadas, permisos universitarios, etc.).',
      'El colaborador debe enviar un correo a Recursos Humanos con copia a su supervisor indicando día y horas.',
    ],
    order: 3,
  },
  {
    id: 'BNF-004',
    title: 'Seguro Médico Complementario',
    icon: 'HeartPulse',
    color: 'emerald',
    appliesTo: 'Todos los colaboradores',
    summary: 'La empresa cubre el 100% del costo del plan médico.',
    details: [
      'Plan Staff: para personal de Staff.',
      'Plan Gerencial: para Gerentes en adelante.',
      'Dependientes adicionales: el colaborador asume el 100% del costo (hijos mayores de 25 años, padres, suegros, etc.).',
      'Cambio de plan permitido en cualquier momento; la diferencia se descuenta vía nómina.',
      'Hijastros requieren autorización expresa del Gerente General.',
      'No se aceptan ex esposos en la póliza; el colaborador debe informar el cambio de estatus.',
      'Es responsabilidad del colaborador enviar el acta de nacimiento de hijos recién nacidos para tramitar el ingreso.',
    ],
    order: 4,
  },
  {
    id: 'BNF-005',
    title: 'Free Days',
    icon: 'CalendarDays',
    color: 'violet',
    appliesTo: 'Todos los colaboradores',
    summary: 'Días libres adicionales a los no laborables por ley.',
    details: [
      'Días libres adicionales como 24 de Diciembre, 31 de Diciembre, Jueves Santo, etc.',
      'Se verifica el calendario año tras año y se comunica oportunamente al personal.',
    ],
    order: 5,
  },
  {
    id: 'BNF-006',
    title: 'Early Fridays',
    icon: 'Sun',
    color: 'orange',
    appliesTo: 'Todos los colaboradores',
    summary: 'Salida a las 3:00 PM los viernes en temporadas seleccionadas.',
    details: [
      'Beneficio activo en Julio, Agosto y Diciembre dependiendo de la temporada.',
      'Salida a las 3:00 PM todos los viernes durante la temporada activa.',
      'Para optar por el beneficio el colaborador no debe tener entregables urgentes pendientes.',
    ],
    order: 6,
  },
  {
    id: 'BNF-007',
    title: 'Reconocimientos e Incentivos',
    icon: 'Award',
    color: 'yellow',
    appliesTo: 'Todos los colaboradores',
    summary: 'Reconocimientos por desempeño, milla extra o proyectos especiales.',
    details: [
      'La empresa fomenta y fortalece el compromiso valorando el trabajo en equipo.',
      'Los reconocimientos pueden ser certificados, días libres, bonos u otros incentivos.',
      'Aprobados por el supervisor y la gerencia general.',
    ],
    order: 7,
  },
];

function ensureSeed() {
  const existing = readData(FILE);
  if (!existing || existing.length === 0) {
    writeData(FILE, DEFAULT_BENEFITS);
    return DEFAULT_BENEFITS;
  }
  return existing;
}

const HR_EDITORS = new Set([
  'daguasvivas@safeone.com.do',
  'tecnologia@safeone.com.do',
  'anoel@safeone.com.do',
]);

function canEdit(req) {
  const email = (req.user?.email || '').toLowerCase();
  if (HR_EDITORS.has(email)) return true;
  if (req.user?.isAdmin) return true;
  if (req.user?.department === 'Recursos Humanos' && req.user?.isDepartmentLeader) return true;
  return false;
}

router.get('/', auth, (req, res) => {
  const list = ensureSeed();
  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(list);
});

router.post('/', auth, (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ message: 'No autorizado' });
  const list = ensureSeed();
  const id = `BNF-${String(Date.now()).slice(-6)}`;
  const newItem = {
    id,
    title: req.body.title || 'Nuevo beneficio',
    icon: req.body.icon || 'Sparkles',
    color: req.body.color || 'amber',
    appliesTo: req.body.appliesTo || 'Todos los colaboradores',
    summary: req.body.summary || '',
    details: Array.isArray(req.body.details) ? req.body.details : [],
    order: list.length + 1,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.email,
  };
  list.push(newItem);
  writeData(FILE, list);
  res.status(201).json(newItem);
});

router.put('/:id', auth, (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ message: 'No autorizado' });
  const list = ensureSeed();
  const idx = list.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Beneficio no encontrado' });
  list[idx] = {
    ...list[idx],
    ...req.body,
    id: list[idx].id,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email,
  };
  writeData(FILE, list);
  res.json(list[idx]);
});

router.delete('/:id', auth, (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ message: 'No autorizado' });
  const list = ensureSeed();
  const filtered = list.filter(b => b.id !== req.params.id);
  writeData(FILE, filtered);
  res.status(204).send();
});

module.exports = router;
