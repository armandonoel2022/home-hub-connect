import { createContext, useContext, useState, ReactNode } from "react";
import type { AppNotification } from "@/lib/types";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Initial mock notifications
const initialNotifications: AppNotification[] = [
  {
    id: "NOT-001",
    type: "purchase",
    title: "Nueva Solicitud de Compra",
    message: "Operaciones ha solicitado la compra de 10 radios portátiles por RD$85,000",
    relatedId: "PR-001",
    forUserId: "USR-002",
    read: true,
    createdAt: "2026-03-05T08:00:00",
    actionUrl: "/solicitudes-compra",
  },
  {
    id: "NOT-002",
    type: "hiring",
    title: "Solicitud de Contratación Pendiente",
    message: "Gerencia Comercial solicita un Ejecutivo de Ventas — requiere aprobación",
    relatedId: "HR-001",
    forUserId: "USR-002",
    read: false,
    createdAt: "2026-03-04T14:00:00",
    actionUrl: "/solicitudes-personal",
  },
];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = (n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    const newN: AppNotification = {
      ...n,
      id: `NOT-${String(Date.now()).slice(-6)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newN, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
