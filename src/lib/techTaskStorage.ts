import type { TechTask } from "./techTaskTypes";

const STORAGE_KEY = "tech-tasks-v1";

// Storage abstraction — ready to swap with API calls
export const techTaskStorage = {
  getAll(userEmail: string): TechTask[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const all: TechTask[] = JSON.parse(raw);
      return all.filter((t) => t.createdBy === userEmail);
    } catch {
      return [];
    }
  },

  save(tasks: TechTask[], userEmail: string) {
    try {
      // Merge with other users' tasks
      const raw = localStorage.getItem(STORAGE_KEY);
      const all: TechTask[] = raw ? JSON.parse(raw) : [];
      const otherTasks = all.filter((t) => t.createdBy !== userEmail);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherTasks, ...tasks]));
    } catch {
      // silently fail
    }
  },

  add(task: TechTask) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: TechTask[] = raw ? JSON.parse(raw) : [];
    all.push(task);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  update(taskId: string, updates: Partial<TechTask>) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: TechTask[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((t) => t.id === taskId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  },

  delete(taskId: string) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: TechTask[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((t) => t.id !== taskId)));
  },
};
