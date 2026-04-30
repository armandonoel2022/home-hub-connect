/**
 * Tipos para el módulo de Capacitaciones BASC.
 */

export type CourseCategory = "Inducción" | "BASC" | "Operaciones" | "Calidad" | "Seguridad" | "Legal" | "Desarrollo" | "Medio Ambiente" | "Responsabilidad Social" | "General";
export type EvaluationMode = "quiz" | "confirm";
export type EnrollmentStatus = "no-iniciado" | "en-progreso" | "completado";

export interface CourseSection {
  id: string;
  title: string;
  /** Markdown-lite: párrafos separados por \n\n. Permite **negrita** simple. */
  content: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  /** Explicación opcional al resolver. */
  explanation?: string;
}

export interface TrainingCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  durationMinutes: number;
  category: CourseCategory;
  mandatory: boolean;
  bascRelated: boolean;
  sections: CourseSection[];
  /** Quiz para administrativos. Mínimo 80% aprueba. */
  quiz: QuizQuestion[];
  /** Frase a confirmar en modo kiosko. */
  confirmStatement: string;
  /** Campos extendidos de planificación */
  participants?: number;
  hoursPerSession?: number;
  totalHH?: number;
  targetAudience?: string;
  /** Targeting granular: a quién va dirigido */
  targetType?: "all" | "departments" | "roles" | "specific";
  targetDepartments?: string[];
  targetUserIds?: string[];
  scheduledMonth?: string;
  executionDate?: string;
  provider?: string;
  instructor?: string;
  /** Flag: curso creado por HR (editable) vs hardcoded */
  isCustom?: boolean;
}

export interface TrainingAttempt {
  id: string;
  mode: EvaluationMode;
  answers: number[];
  score: number | null;
  passed: boolean;
  takenAt: string;
}

export interface TrainingEnrollment {
  id: string;
  userId: string;
  courseId: string;
  startedAt: string;
  currentSection: number;
  sectionsRead: number[];
  status: EnrollmentStatus;
  attempts: TrainingAttempt[];
  completedAt?: string;
  score?: number | null;
  updatedAt: string;
}

export interface TrainingCertificate {
  id: string;
  userId: string;
  fullName: string;
  position: string;
  department: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  score: number | null;
  issuedAt: string;
  verificationCode: string;
}
