/**
 * Seed de cursos BASC SafeOne Security Company.
 * Los cursos se cargan desde el frontend (src/lib/trainingCourses.ts) –
 * este archivo sólo entrega la metadata mínima para bootstrap del backend.
 * Cuando el frontend pide /courses obtiene este array; el contenido completo
 * (secciones + quiz) vive en el frontend para evitar duplicación de strings.
 */
const COURSES_SEED = [
  {
    id: 'CRS-INDUC',
    code: 'CAP-001',
    title: 'Inducción SafeOne Security Company',
    description: 'Historia, misión, visión y valores corporativos.',
    durationMinutes: 15,
    mandatory: true,
    category: 'Inducción',
    bascRelated: false,
  },
  {
    id: 'CRS-PO-G-01',
    code: 'PO-G-01',
    title: 'Política General de Seguridad',
    description: 'Procedimiento PO-G-01: política, alcance, comunicación y revisión.',
    durationMinutes: 20,
    mandatory: true,
    category: 'BASC',
    bascRelated: true,
  },
  {
    id: 'CRS-BASC-AWARE',
    code: 'CAP-002',
    title: 'Concientización BASC: Lavado, Soborno y Contrabando',
    description: 'Prevención de actividades ilícitas exigida por la certificación BASC.',
    durationMinutes: 25,
    mandatory: true,
    category: 'BASC',
    bascRelated: true,
  },
];

module.exports = { COURSES_SEED };
