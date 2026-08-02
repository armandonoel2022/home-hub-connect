import type { Transition, Variants } from "framer-motion";

/** Física de resortes — nada lineal. */
export const springSoft: Transition = { type: "spring", stiffness: 110, damping: 16, mass: 1 };
export const springSnappy: Transition = { type: "spring", stiffness: 320, damping: 20, mass: 0.6 };
export const springBouncy: Transition = { type: "spring", stiffness: 420, damping: 12, mass: 0.5 };

/** Perspectiva 3D del gabinete (se aplica al contenedor). */
export const perspective = 2400;

/** Gabinete completo: respira al montarse. */
export const cabinetVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, rotateX: 6 },
  visible: { opacity: 1, scale: 1, rotateX: 0, transition: { ...springSoft, staggerChildren: 0.08 } },
};

/** Puertas metálicas: cerrado = entreabierto en perspectiva; abierto = de frente. */
export const doorVariants: Variants = {
  closed: (dir: number) => ({ rotateY: -34 * dir, scale: 0.97, transition: springSoft }),
  open: () => ({ rotateY: 0, scale: 1, transition: springSoft }),
};

/** Tablero: escalona la aparición de las llaves. */
export const boardVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.22 } },
};

/** Ganchos: siempre visibles, con un leve asentamiento metálico. */
export const hookVariants: Variants = {
  hidden: { opacity: 0.35, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: springSnappy },
};

/** Gancho vacío: pulso muy sutil para indicar posición libre. */
export const emptyHookVariants: Variants = {
  visible: {
    opacity: [0.55, 0.85, 0.55],
    transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
  },
};

/** Llave colgando: entra desde arriba y se balancea como objeto suspendido. */
export const keyVariants: Variants = {
  hidden: { opacity: 0, y: -18, rotate: -14, scale: 0.86 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotate: [-9, 6, -3.5, 1.6, 0],
    transition: {
      opacity: { duration: 0.2 },
      y: springSnappy,
      scale: springSnappy,
      rotate: { duration: 1.5, ease: [0.22, 1, 0.36, 1] },
    },
  },
};

/** Balanceo permanente muy leve (objeto suspendido). */
export const swingVariants: Variants = {
  idle: (delay: number = 0) => ({
    rotate: [0, 1.6, 0, -1.6, 0],
    transition: { duration: 5.5, repeat: Infinity, ease: "easeInOut", delay },
  }),
};

/** Se desprende del gancho: sube, gira y desaparece. */
export const takeKeyVariants: Variants = {
  taken: { y: -34, rotate: 22, scale: 0.82, opacity: 0, transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] } },
};

/** Regresa colgando con un pequeño rebote. */
export const returnKeyVariants: Variants = {
  returned: { y: [-26, 4, -2, 0], rotate: [12, -6, 3, 0], opacity: 1, scale: 1, transition: springBouncy },
};

/** Hover: se levanta, se balancea y crece un poco. */
export const hoverKey = {
  y: -5,
  scale: 1.09,
  rotate: [0, -4, 3, -1.5, 0],
  transition: { rotate: { duration: 0.7, ease: "easeInOut" }, default: springSnappy },
};

/** Tap: presión corta y elástica. */
export const tapKey = { scale: 0.93, y: -9, rotate: 6, transition: springBouncy };
