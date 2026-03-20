import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { isApiConfigured, notificationsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const apiMode = isApiConfigured();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load notifications from server
  useEffect(() => {
    if (!apiMode || !user) return;
    notificationsApi.getForUser(user.id).then(setNotifications).catch(console.error);
    // Poll every 10 seconds for new notifications (panic alerts, etc.)
    const interval = setInterval(() => {
      notificationsApi.getForUser(user.id).then(setNotifications).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [apiMode, user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    if (apiMode) {
      notificationsApi.create(n).then((created) => {
        setNotifications((prev) => [created, ...prev]);
      }).catch(console.error);
    } else {
      const newN: AppNotification = {
        ...n,
        id: `NOT-${String(Date.now()).slice(-6)}`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [newN, ...prev]);
    }
  }, [apiMode]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (apiMode) notificationsApi.markRead(id).catch(() => {});
  }, [apiMode]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (apiMode && user) notificationsApi.markAllRead(user.id).catch(() => {});
  }, [apiMode, user]);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (apiMode) notificationsApi.delete(id).catch(() => {});
  }, [apiMode]);

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
