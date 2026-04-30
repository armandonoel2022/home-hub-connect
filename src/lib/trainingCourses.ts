/**
 * Contenido completo de los cursos de capacitación SafeOne.
 * Incluye cursos BASC, operacionales, legales, medio ambiente, etc.
 * RRHH puede agregar/editar/eliminar cursos desde la UI de administración.
 */
import type { TrainingCourse } from "./trainingTypes";

// ─── Local storage for HR-managed courses ────────────────────────────────
const LS_COURSES_KEY = "safeone_custom_courses_v1";

export function loadCustomCourses(): TrainingCourse[] {
  try { return JSON.parse(localStorage.getItem(LS_COURSES_KEY) || "[]"); }
  catch { return []; }
}

export function saveCustomCourses(courses: TrainingCourse[]) {
  localStorage.setItem(LS_COURSES_KEY, JSON.stringify(courses));
}

/** All courses: hardcoded defaults + HR custom ones */
export function getAllCourses(): TrainingCourse[] {
  const custom = loadCustomCourses();
  // Custom courses can override defaults by ID
  const customIds = new Set(custom.map(c => c.id));
  const defaults = DEFAULT_COURSES.filter(c => !customIds.has(c.id));
  return [...defaults, ...custom];
}

export const TRAINING_COURSES: TrainingCourse[] = []; // legacy compat – use getAllCourses()

// Helper function
function makeSimpleCourse(opts: {
  id: string; code: string; title: string; description: string;
  durationMinutes: number; category: TrainingCourse["category"];
  mandatory: boolean; bascRelated: boolean;
  participants?: number; hoursPerSession?: number; totalHH?: number;
  targetAudience?: string; scheduledMonth?: string; executionDate?: string;
  provider?: string; instructor?: string;
}): TrainingCourse {
  return {
    ...opts,
    sections: [{
      id: "s1", title: "Contenido del curso",
      content: `Bienvenido al curso **${opts.title}**.\n\nEste material será impartido por ${opts.instructor || opts.provider || "el instructor asignado"}.\n\nEl contenido detallado de esta capacitación será proporcionado por el instructor durante la sesión.`,
    }],
    quiz: [],
    confirmStatement: `He asistido y comprendido el contenido de la capacitación "${opts.title}".`,
  };
}

export const DEFAULT_COURSES: TrainingCourse[] = [
  // ════════════════════════════════════════
  // 1. INDUCCIÓN SAFEONE
  // ════════════════════════════════════════
  {
    id: "CRS-INDUC",
    code: "CAP-001",
    title: "Inducción SafeOne Security Company",
    description:
      "Conoce nuestra historia, misión, visión y los valores que nos definen como líderes en seguridad privada en República Dominicana.",
    durationMinutes: 15,
    category: "Inducción",
    mandatory: true,
    bascRelated: false,
    confirmStatement:
      "He leído y comprendido la historia, misión, visión y valores de SafeOne Security Company.",
    sections: [
      {
        id: "s1",
        title: "Bienvenido(a) a SafeOne",
        content:
          "Te damos la más cordial bienvenida al equipo de **SafeOne Security Company**. " +
          "Eres parte de una empresa con más de **35 años de experiencia** en el mercado dominicano, " +
          "consolidada como líder en servicios de seguridad y prevención de riesgos.\n\n" +
          "Esta capacitación te tomará aproximadamente 15 minutos. Al finalizarla recibirás un " +
          "certificado oficial que avala tu conocimiento de los pilares de nuestra empresa.",
      },
      {
        id: "s2",
        title: "Nuestra historia",
        content:
          "Desde nuestros inicios, hemos estado comprometidos a ofrecer soluciones integrales " +
          "para proteger lo más valioso: la **tranquilidad de nuestros clientes**.\n\n" +
          "A lo largo de tres décadas hemos evolucionado, incorporando la tecnología más avanzada " +
          "en los servicios y productos que ofrecemos. Entre ellos destacan: sistemas de CCTV, " +
          "alarmas de intrusión, sistemas de monitoreo de alarmas, control de acceso, detección " +
          "de incendios y muchas otras soluciones que se adaptan a las necesidades específicas " +
          "de cada cliente.\n\n" +
          "Nuestra meta es seguir innovando y perfeccionando nuestros servicios para garantizar " +
          "una protección efectiva y confiable en todo momento.",
      },
      {
        id: "s3",
        title: "Misión",
        content:
          "**Proteger la integridad de nuestros clientes, su patrimonio y de sus relacionados, " +
          "de una manera eficiente, con productos y servicios que excedan sus expectativas.**",
      },
      {
        id: "s4",
        title: "Visión",
        content:
          "**Ser la empresa con el más alto valor y compromiso de ética, capacidad técnica, " +
          "para que la sociedad nos identifique como LA SEGURIDAD.**",
      },
      {
        id: "s5",
        title: "Nuestros valores",
        content:
          "Somos una compañía comprometida, dinámica y enérgica que busca constantemente dejar su huella. " +
          "Dentro de nuestros valores están:\n\n" +
          "• **Responsabilidad** — asumimos el compromiso con cada cliente y compañero.\n" +
          "• **Profesionalidad** — actuamos con el más alto estándar técnico y ético.\n" +
          "• **Trabajo en equipo** — la seguridad es una cadena; cada eslabón cuenta.\n" +
          "• **Eficiencia** — hacemos más con menos, sin sacrificar calidad.\n" +
          "• **Innovación** — incorporamos tecnología y mejores prácticas continuamente.\n" +
          "• **Honestidad** — la confianza del cliente es nuestro mayor activo.",
      },
    ],
    quiz: [
      {
        id: "q1",
        question: "¿Cuántos años de experiencia tiene SafeOne Security Company en el mercado?",
        options: ["10 años", "20 años", "35 años", "50 años"],
        correctIndex: 2,
      },
      {
        id: "q2",
        question: "Según nuestra misión, ¿qué protegemos?",
        options: [
          "Únicamente los bienes materiales del cliente",
          "La integridad del cliente, su patrimonio y sus relacionados",
          "Solo las instalaciones físicas",
          "Únicamente la información digital",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        question: "¿Cuál de los siguientes NO es un valor corporativo de SafeOne?",
        options: ["Honestidad", "Innovación", "Competencia desleal", "Trabajo en equipo"],
        correctIndex: 2,
      },
      {
        id: "q4",
        question: "Nuestra visión expresa que la sociedad nos identifique como…",
        options: ["LA SEGURIDAD", "LA EMPRESA", "LA TECNOLOGÍA", "EL VIGILANTE"],
        correctIndex: 0,
      },
      {
        id: "q5",
        question: "¿Qué tipo de soluciones ofrece SafeOne además de la vigilancia armada?",
        options: [
          "Solo CCTV",
          "Solo alarmas",
          "CCTV, alarmas, monitoreo, control de acceso y detección de incendios",
          "Únicamente seguridad electrónica",
        ],
        correctIndex: 2,
      },
    ],
  },

  // ════════════════════════════════════════
  // 2. PO-G-01 POLÍTICA GENERAL DE SEGURIDAD
  // ════════════════════════════════════════
  {
    id: "CRS-PO-G-01",
    code: "PO-G-01",
    title: "Política General de Seguridad (PO-G-01)",
    description:
      "Procedimiento oficial PO-G-01. Aprende los fundamentos de nuestra Política General de Seguridad y su aplicación en el SGCS BASC.",
    durationMinutes: 20,
    category: "BASC",
    mandatory: true,
    bascRelated: true,
    confirmStatement:
      "He leído y comprendido la Política General de Seguridad PO-G-01 y me comprometo a cumplirla en mis funciones diarias.",
    sections: [
      {
        id: "s1",
        title: "Objetivo del procedimiento",
        content:
          "Mantener a la empresa identificada con una **Política General de Control y Seguridad** " +
          "que sirva de base para establecer los objetivos de seguridad aplicables a todos los " +
          "procesos relevantes cubiertos por el **SGCS BASC** (Sistema de Gestión de Control y Seguridad).",
      },
      {
        id: "s2",
        title: "Terminología clave",
        content:
          "• **Política de Seguridad:** intenciones y directrices generales de la organización " +
          "relativas a su compromiso con la seguridad y la prevención de riesgos.\n\n" +
          "• **Alta Dirección:** persona o grupo que conforma el más alto nivel jerárquico de la empresa.\n\n" +
          "• **Mejora Continua:** actividad permanente para incrementar la capacidad del SGCS de " +
          "cumplir los requisitos establecidos.\n\n" +
          "• **SGCS BASC:** conjunto de reglas y principios de seguridad interrelacionados que " +
          "evidencian el cumplimiento de los requisitos para la certificación BASC.",
      },
      {
        id: "s3",
        title: "Alcance y responsables",
        content:
          "Esta política es aplicable a **todos los departamentos, procesos y personal** de la empresa, " +
          "así como a las partes interesadas pertinentes (clientes, proveedores y socios).\n\n" +
          "**Responsables:**\n" +
          "• La **Gerencia General** formula, aprueba, revisa y difunde la política.\n" +
          "• La **Gerencia de Recursos Humanos** ejecuta su implementación.\n" +
          "• El **Departamento de Operaciones** apoya la aplicación operativa.",
      },
      {
        id: "s4",
        title: "Política de Seguridad oficial",
        content:
          "**SAFEONE SECURITY COMPANY, SRL** está comprometida con la seguridad de sus clientes, " +
          "así como con la protección de sus activos, personal e instalaciones, a través de la " +
          "implementación y mantenimiento de un Sistema de Gestión orientado a la mejora continua, " +
          "la gestión de riesgos y la **prevención de actividades ilícitas**.\n\n" +
          "Nuestra política se fundamenta en el estricto cumplimiento de los requisitos legales y " +
          "regulatorios aplicables, así como en la adopción de estándares internacionales de " +
          "seguridad. Nos comprometemos a **prevenir y mitigar riesgos relacionados con el lavado " +
          "de activos, el soborno y la corrupción**, garantizando la integridad y transparencia " +
          "en todas nuestras operaciones.\n\n" +
          "Fomentamos el cumplimiento normativo y de las responsabilidades de todo nuestro personal, " +
          "fortaleciendo la cultura de seguridad, asegurando la protección de la información y " +
          "ofreciendo a nuestros clientes un servicio confiable, ético y responsable.",
      },
      {
        id: "s5",
        title: "Comunicación y concientización",
        content:
          "La política se comunica mediante:\n\n" +
          "• Letreros y carteles visibles en oficinas y puestos.\n" +
          "• Boletines internos, correos y publicaciones digitales.\n" +
          "• **Sesiones de inducción y entrenamiento** (como esta).\n" +
          "• Charlas presenciales y material físico (brochures, afiches).\n" +
          "• Comunicación a partes externas (clientes, proveedores, socios estratégicos).\n\n" +
          "Es **obligatoria** como parte del proceso de inducción de nuevos empleados y en sesiones " +
          "de refrescamiento para el personal activo.",
      },
      {
        id: "s6",
        title: "Revisión y actualización",
        content:
          "• La política se verifica **al menos una vez al año** o cuando ocurren cambios " +
          "significativos en las operaciones.\n" +
          "• Si no hay cambios, la Gerencia la **ratifica** dejando constancia de la fecha.\n" +
          "• Toda actualización requiere aprobación de la Alta Dirección y se registra en el " +
          "control documental del SGCS BASC.\n\n" +
          "**Versión vigente:** 1.0 — publicada el 06/10/2025 por Chrisnel Fabián.",
      },
    ],
    quiz: [
      {
        id: "q1",
        question: "¿Qué siglas representan al sistema de gestión que aplica esta política?",
        options: ["ISO 9001", "SGCS BASC", "OSHA", "OHSAS 18001"],
        correctIndex: 1,
      },
      {
        id: "q2",
        question: "¿Quién es responsable de formular y aprobar la Política General de Seguridad?",
        options: ["RRHH", "Operaciones", "Gerencia General", "El supervisor de cada puesto"],
        correctIndex: 2,
      },
      {
        id: "q3",
        question: "La Política General de Seguridad aplica a:",
        options: [
          "Solo al personal armado",
          "Solo a la gerencia",
          "Todos los departamentos, procesos, personal y partes interesadas",
          "Solo al departamento de Calidad",
        ],
        correctIndex: 2,
      },
      {
        id: "q4",
        question: "¿Con qué frecuencia mínima debe revisarse la política?",
        options: ["Cada 5 años", "Cada 2 años", "Una vez al año o ante cambios significativos", "Nunca, es permanente"],
        correctIndex: 2,
      },
      {
        id: "q5",
        question: "La política se compromete a prevenir riesgos relacionados con:",
        options: [
          "Únicamente robos físicos",
          "Lavado de activos, soborno y corrupción",
          "Solo accidentes laborales",
          "Solo fraudes informáticos",
        ],
        correctIndex: 1,
      },
      {
        id: "q6",
        question: "¿Cuál NO es un mecanismo válido de difusión de la política?",
        options: [
          "Carteles visibles",
          "Sesiones de inducción",
          "Comentarios verbales informales sin registro",
          "Boletines y correos",
        ],
        correctIndex: 2,
      },
    ],
  },

  // ════════════════════════════════════════
  // 3. CONCIENTIZACIÓN BASC
  // ════════════════════════════════════════
  {
    id: "CRS-BASC-AWARE",
    code: "CAP-002",
    title: "Concientización BASC: Lavado, Soborno y Contrabando",
    description:
      "Curso obligatorio BASC. Aprende a identificar y prevenir las principales actividades ilícitas que pueden afectar la cadena de suministro.",
    durationMinutes: 25,
    category: "BASC",
    mandatory: true,
    bascRelated: true,
    confirmStatement:
      "He leído y comprendido los conceptos básicos de prevención BASC sobre lavado de activos, soborno y contrabando, y conozco cómo reportar actividades sospechosas.",
    sections: [
      {
        id: "s1",
        title: "¿Qué es BASC?",
        content:
          "**BASC** (Business Alliance for Secure Commerce) es una alianza empresarial internacional " +
          "que promueve un comercio seguro en cooperación con gobiernos y organismos internacionales.\n\n" +
          "Como empresa certificada (en proceso de certificación), SafeOne se compromete a mantener " +
          "un **Sistema de Gestión en Control y Seguridad (SGCS)** que prevenga el uso de nuestras " +
          "operaciones para actividades ilícitas.\n\n" +
          "Tu rol como empleado es **clave**: eres el primer filtro de detección.",
      },
      {
        id: "s2",
        title: "Lavado de activos",
        content:
          "El **lavado de activos** es el proceso mediante el cual personas u organizaciones " +
          "intentan dar apariencia de legalidad a dinero proveniente de actividades ilícitas " +
          "(narcotráfico, corrupción, trata de personas, etc.).\n\n" +
          "**Señales de alerta:**\n" +
          "• Pagos en efectivo inusualmente altos.\n" +
          "• Clientes que evitan dar información o documentos.\n" +
          "• Múltiples transacciones fragmentadas para evitar controles.\n" +
          "• Solicitudes de facturación a nombre de terceros sin justificación.\n\n" +
          "**Qué hacer:** reportar inmediatamente a tu supervisor o al Encargado de Calidad.",
      },
      {
        id: "s3",
        title: "Soborno y corrupción",
        content:
          "El **soborno** consiste en ofrecer, dar, recibir o solicitar cualquier cosa de valor " +
          "para influir en una decisión o acción, ya sea en el sector público o privado.\n\n" +
          "**Política SafeOne — Tolerancia Cero:**\n" +
          "• No se aceptan regalos, comisiones ni favores que puedan comprometer la imparcialidad.\n" +
          "• Cualquier intento de soborno debe ser reportado de inmediato.\n" +
          "• Las relaciones con autoridades, clientes y proveedores se manejan con total transparencia.\n\n" +
          "Recuerda: aceptar un soborno no solo es ilegal, sino que pone en riesgo tu empleo, " +
          "tu libertad y la reputación de la empresa.",
      },
      {
        id: "s4",
        title: "Contrabando y narcotráfico",
        content:
          "El **contrabando** es la entrada o salida de mercancías evadiendo controles aduanales o " +
          "legales. El **narcotráfico** utiliza con frecuencia empresas legítimas y sus medios de " +
          "transporte para mover sustancias ilícitas.\n\n" +
          "**Riesgos en nuestra operación:**\n" +
          "• Vehículos de la flota o de clientes pueden ser usados sin nuestro conocimiento.\n" +
          "• Personal armado en puestos puede ser presionado o sobornado.\n" +
          "• Información confidencial puede ser solicitada por terceros con malas intenciones.\n\n" +
          "**Controles obligatorios:**\n" +
          "• Inspección visual de vehículos y mercancías al ingreso/salida de instalaciones del cliente.\n" +
          "• Verificación de identidad de cualquier persona que solicite información sensible.\n" +
          "• Bitácoras y registros completos de cada turno.",
      },
      {
        id: "s5",
        title: "Tu responsabilidad como empleado SafeOne",
        content:
          "**1. Conoce tu puesto:** lee y aplica los procedimientos específicos de tu área.\n\n" +
          "**2. Observa y reporta:** cualquier conducta o situación inusual debe ser reportada.\n\n" +
          "**3. Protege la información:** no compartas datos del cliente, rutas, horarios ni " +
          "información operativa con personas no autorizadas.\n\n" +
          "**4. Cuida tu credencial e identificación:** son tu autorización para operar.\n\n" +
          "**5. Participa en las capacitaciones:** la formación continua es tu mejor defensa.\n\n" +
          "**Canales de reporte:**\n" +
          "• Tu supervisor directo.\n" +
          "• Encargada de Calidad: Bilianny Fernández (Bfernandez@safeone.com.do).\n" +
          "• Gerencia de RRHH: Dilia Aguasvivas (Daguasvivas@safeone.com.do).\n" +
          "• Línea de denuncias confidencial (próximamente).",
      },
    ],
    quiz: [
      {
        id: "q1",
        question: "¿Qué significa BASC?",
        options: [
          "Banco Asociado de Servicios Confidenciales",
          "Business Alliance for Secure Commerce",
          "Brigada Anti-Soborno y Contrabando",
          "Buró Americano de Seguridad Corporativa",
        ],
        correctIndex: 1,
      },
      {
        id: "q2",
        question: "¿Cuál es la política de SafeOne ante el soborno?",
        options: [
          "Aceptar regalos pequeños está permitido",
          "Tolerancia cero — debe reportarse de inmediato",
          "Depende del valor del regalo",
          "Solo aplica a la gerencia",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        question: "Una señal de alerta de lavado de activos es:",
        options: [
          "Pagos con tarjeta de crédito",
          "Pagos en efectivo inusualmente altos sin justificación",
          "Facturación electrónica",
          "Solicitar una cotización formal",
        ],
        correctIndex: 1,
      },
      {
        id: "q4",
        question: "Si detectas una situación sospechosa en tu puesto, debes:",
        options: [
          "Ignorarla si no te afecta directamente",
          "Confrontar a la persona involucrada",
          "Reportarla a tu supervisor o al Encargado de Calidad",
          "Esperar a que pase y comentarlo después",
        ],
        correctIndex: 2,
      },
      {
        id: "q5",
        question: "¿Quién es responsable de aplicar los controles BASC?",
        options: [
          "Solo la gerencia",
          "Solo el departamento de Calidad",
          "Todo el personal de la empresa",
          "Solo el personal armado",
        ],
        correctIndex: 2,
      },
      {
        id: "q6",
        question: "Compartir rutas, horarios o información del cliente con terceros no autorizados:",
        options: [
          "Está permitido entre compañeros",
          "Es una violación grave a la política de seguridad",
          "Depende del cliente",
          "Solo está prohibido por escrito",
        ],
        correctIndex: 1,
      },
      {
        id: "q7",
        question: "¿A quién puedes reportar una sospecha de actividad ilícita?",
        options: [
          "Solo al gerente general",
          "A nadie, no es tu problema",
          "A tu supervisor, Calidad o RRHH",
          "A las autoridades sin pasar por la empresa",
        ],
        correctIndex: 2,
      },
    ],
  },

  // ════════════════════════════════════════
  // CURSOS ADICIONALES (Plan de Capacitación Anual)
  // ════════════════════════════════════════
  makeSimpleCourse({ id: "CRS-AUD-INT", code: "CAP-003", title: "Capacitación de Auditor Interno BASC", description: "Formación para auditores internos del SGCS BASC.", durationMinutes: 2400, category: "BASC", mandatory: true, bascRelated: true, participants: 2, hoursPerSession: 40, totalHH: 80, targetAudience: "Gerente RH, Gerente Op", scheduledMonth: "TBD", provider: "BASC" }),
  makeSimpleCourse({ id: "CRS-REQ-BASC", code: "CAP-004", title: "Requisitos del Sistema de Gestión BASC", description: "Charla sobre los requisitos del sistema de gestión BASC.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 11, hoursPerSession: 1, totalHH: 11, targetAudience: "Personal puestos crítico", scheduledMonth: "Abril", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-GEST-RIESG", code: "CAP-005", title: "Charla Gestión de Riesgos", description: "Identificación y gestión de riesgos en la operación.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 8, hoursPerSession: 1, totalHH: 8, targetAudience: "Personal puestos crítico", scheduledMonth: "Julio", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-AMENAZAS", code: "CAP-006", title: "Charla Concientización sobre Amenazas", description: "Concientización sobre amenazas a la seguridad.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 8, hoursPerSession: 1, totalHH: 8, targetAudience: "Personal puestos crítico", scheduledMonth: "Junio", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-REQ-LEG", code: "CAP-007", title: "Charla Requisitos Legales BASC", description: "Requisitos legales aplicables al SGCS BASC.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 10, hoursPerSession: 1, totalHH: 10, targetAudience: "Personal puestos crítico", scheduledMonth: "Octubre", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-CIBER", code: "CAP-008", title: "Charla sobre Ciberseguridad", description: "Concientización en ciberseguridad y protección de datos.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 12, hoursPerSession: 1, totalHH: 12, targetAudience: "Personal puestos crítico", scheduledMonth: "Octubre", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-ANTISOB", code: "CAP-009", title: "Charla Antisoborno y Corrupción", description: "Prevención del soborno y la corrupción.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 11, hoursPerSession: 1, totalHH: 11, targetAudience: "Personal puestos crítico", scheduledMonth: "Septiembre", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-COD-LAB", code: "CAP-010", title: "Introducción al Código Laboral", description: "Fundamentos del código laboral dominicano.", durationMinutes: 60, category: "Legal", mandatory: false, bascRelated: false, participants: 12, hoursPerSession: 1, targetAudience: "Supervisores Operaciones", scheduledMonth: "Mayo", provider: "Joel Perez-Abogado", instructor: "Joel Perez-Abogado" }),
  makeSimpleCourse({ id: "CRS-DEF-PERS", code: "CAP-011", title: "Manejo y Defensa Personal", description: "Técnicas de manejo y defensa personal.", durationMinutes: 240, category: "Seguridad", mandatory: false, bascRelated: false, participants: 10, hoursPerSession: 4, targetAudience: "Supervisores Operaciones", scheduledMonth: "Junio", provider: "Infotep" }),
  makeSimpleCourse({ id: "CRS-COM-ASERT", code: "CAP-012", title: "Comunicación Asertiva", description: "Desarrollo de habilidades de comunicación asertiva.", durationMinutes: 60, category: "Desarrollo", mandatory: false, bascRelated: false, participants: 6, hoursPerSession: 1, totalHH: 6, targetAudience: "Todos", scheduledMonth: "Abril", provider: "Infotep" }),
  makeSimpleCourse({ id: "CRS-REFOREST", code: "CAP-013", title: "Jornada de Reforestación", description: "Actividad de responsabilidad ambiental.", durationMinutes: 240, category: "Medio Ambiente", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 4, targetAudience: "Todos", scheduledMonth: "Abril", provider: "Medio Ambiente" }),
  makeSimpleCourse({ id: "CRS-ATEN-CLI", code: "CAP-014", title: "Atención y Servicio al Cliente", description: "Mejora de la atención y servicio al cliente.", durationMinutes: 240, category: "Desarrollo", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 4, targetAudience: "Todos", scheduledMonth: "Noviembre", provider: "Infotep" }),
  makeSimpleCourse({ id: "CRS-INCENDIOS", code: "CAP-015", title: "Prevención y Manejo de Incendios", description: "Técnicas de prevención y manejo de incendios.", durationMinutes: 240, category: "Seguridad", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 4, targetAudience: "Todos", scheduledMonth: "Noviembre", provider: "Infotep" }),
  makeSimpleCourse({ id: "CRS-ADICCIONES", code: "CAP-016", title: "Charla Prevención de Adicciones", description: "Prevención del uso de sustancias.", durationMinutes: 60, category: "General", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 1, targetAudience: "Todos", scheduledMonth: "Diciembre", provider: "Infotep" }),
  makeSimpleCourse({ id: "CRS-PRIM-AUX", code: "CAP-017", title: "Primeros Auxilios", description: "Técnicas básicas de primeros auxilios.", durationMinutes: 240, category: "Seguridad", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 4, targetAudience: "Todos", scheduledMonth: "Diciembre", provider: "Infotep" }),
  makeSimpleCourse({ id: "CRS-SIMULACRO", code: "CAP-018", title: "Simulacro Evacuación de Emergencias", description: "Práctica de evacuación ante emergencias.", durationMinutes: 60, category: "Seguridad", mandatory: true, bascRelated: false, participants: 25, hoursPerSession: 1, totalHH: 18, targetAudience: "Todos", scheduledMonth: "Mayo" }),
  makeSimpleCourse({ id: "CRS-RSE", code: "CAP-019", title: "Charla Responsabilidad Social Empresarial", description: "Responsabilidad social empresarial y BASC.", durationMinutes: 60, category: "BASC", mandatory: false, bascRelated: true, participants: 13, hoursPerSession: 1, totalHH: 13, targetAudience: "Todos", scheduledMonth: "Abril", executionDate: "10-abr", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-COSTAS", code: "CAP-020", title: "Jornada de Limpieza de Costas", description: "Actividad ambiental de limpieza de costas.", durationMinutes: 240, category: "Medio Ambiente", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 4, targetAudience: "Todos", scheduledMonth: "Octubre", provider: "Medio Ambiente" }),
  makeSimpleCourse({ id: "CRS-DELITOS-COM", code: "CAP-021", title: "Charla Prevención de Delitos en el Comercio Internacional", description: "Prevención de delitos en el comercio internacional.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 25, hoursPerSession: 1, totalHH: 9, targetAudience: "Todos", scheduledMonth: "Septiembre", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-LAVADO", code: "CAP-022", title: "Charla Prevención Lavado de Activos", description: "Prevención del lavado de activos.", durationMinutes: 60, category: "BASC", mandatory: true, bascRelated: true, participants: 25, hoursPerSession: 1, totalHH: 9, targetAudience: "Todos", scheduledMonth: "Septiembre", provider: "Basc", instructor: "Jose Abreu" }),
  makeSimpleCourse({ id: "CRS-PARQUE", code: "CAP-023", title: "Limpieza de Parque Comunitario Las Praderas", description: "Actividad de responsabilidad social.", durationMinutes: 240, category: "Medio Ambiente", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 4, targetAudience: "Todos", scheduledMonth: "TBD", provider: "Medio Ambiente" }),
  makeSimpleCourse({ id: "CRS-CIEGOS", code: "CAP-024", title: "Visita Asociación Dominicana de Ciegos", description: "Actividad de responsabilidad social.", durationMinutes: 240, category: "Responsabilidad Social", mandatory: false, bascRelated: false, participants: 25, hoursPerSession: 4, targetAudience: "Todos", scheduledMonth: "TBD", provider: "Responsabilidad Social" }),
  makeSimpleCourse({ id: "CRS-ARMAS", code: "CAP-025", title: "Manejo de Armas de Fuego", description: "Capacitación en manejo seguro de armas de fuego.", durationMinutes: 60, category: "Seguridad", mandatory: false, bascRelated: false, participants: 10, targetAudience: "Vigilantes, supervisores, coordinadores", scheduledMonth: "TBD", provider: "Superintendencia Seguridad Privada" }),
];

export const getCourseById = (id: string) => getAllCourses().find((c) => c.id === id);
