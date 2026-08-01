import type { Transition, Variants } from "framer-motion";

export const springSoft: Transition = { type: "spring", stiffness: 120, damping: 18, mass: 0.9 };
export const springSnappy: Transition = { type: "spring", stiffness: 300, damping: 22 };

export const doorVariants: Variants = {
  closed: (dir: number) => ({ rotateY: 0 * dir, transition: springSoft }),
  open: (dir: number) => ({ rotateY: -105 * dir, transition: springSoft }),
};

export const boardVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.02, delayChildren: 0.12 } },
};

export const keyVariants: Variants = {
  hidden: { opacity: 0, y: -14, scale: 0.85 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springSnappy },
  removed: { opacity: 0, y: -26, scale: 0.7, transition: { duration: 0.22 } },
};

export const hoverKey = { scale: 1.12, rotate: 4 };
export const tapKey = { scale: 0.94, y: -6 };
