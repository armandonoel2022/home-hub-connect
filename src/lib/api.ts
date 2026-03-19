/**
 * API Service Layer for SafeOne Intranet
 * 
 * Dual-mode: Uses SQL Server API when VITE_API_URL is configured,
 * falls back to mock data for development.
 * 
 * Backend API should be Node.js/Express or .NET running on the local server.
 * 
 * .env config:
 *   VITE_API_URL=http://192.168.1.X:3000/api
 */

import type {
  Ticket, Equipment, Vehicle, ArmedPersonnel, PhoneDevice,
  IntranetUser, PurchaseRequest, HiringRequest, MinorPurchase,
} from "./types";
import type { AppNotification } from "./types";

// ─── Configuration ───
// Auto-detect API URL: use env var, or same hostname on port 3000
function getBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // In production, assume API runs on same server, port 3000
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3000/api`;
  }
  return "";
}

const BASE_URL = getBaseUrl();

/** Returns true when a backend API URL is configured */
export const isApiConfigured = () => !!BASE_URL;

// ─── Core Fetch Helper ───
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new Error("API_NOT_CONFIGURED");
  }

  const token = localStorage.getItem("safeone_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (res.status === 401) {
    localStorage.removeItem("safeone_token");
    localStorage.removeItem("safeone_user");
    // Only redirect if not already on login page to avoid infinite loop
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = "/login";
    }
    throw new Error("No autorizado");
  }

  if (res.status === 403) {
    throw new Error("No tienes acceso a este recurso");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Error del servidor" }));
    throw new Error(err.message || `Error ${res.status}`);
  }

  // Handle 204 No Content
  if (res.status === 204) return {} as T;

  return res.json();
}

// ─── Auth API ───
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: IntranetUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => {
    const token = localStorage.getItem("safeone_token");
    localStorage.removeItem("safeone_token");
    localStorage.removeItem("safeone_user");
    if (BASE_URL && token) {
      // Fire-and-forget server logout
      fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  },
  refresh: () =>
    apiFetch<{ token: string }>("/auth/refresh", { method: "POST" }),
  me: () =>
    apiFetch<IntranetUser>("/auth/me"),
};

// ─── Users API ───
export const usersApi = {
  getAll: () => apiFetch<IntranetUser[]>("/users"),
  getById: (id: string) => apiFetch<IntranetUser>(`/users/${id}`),
  create: (user: Omit<IntranetUser, "id">) =>
    apiFetch<IntranetUser>("/users", { method: "POST", body: JSON.stringify(user) }),
  update: (id: string, data: Partial<IntranetUser>) =>
    apiFetch<IntranetUser>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
  offboard: (id: string, data: { reason: string; notes: string }) =>
    apiFetch<IntranetUser>(`/users/${id}/offboard`, { method: "POST", body: JSON.stringify(data) }),
  reactivate: (id: string) =>
    apiFetch<IntranetUser>(`/users/${id}/reactivate`, { method: "POST" }),
  getBirthdaysToday: () => apiFetch<IntranetUser[]>("/users/birthdays/today"),
};

// ─── Tickets API ───
export const ticketsApi = {
  getAll: () => apiFetch<Ticket[]>("/tickets"),
  getById: (id: string) => apiFetch<Ticket>(`/tickets/${id}`),
  create: (ticket: Omit<Ticket, "id">) =>
    apiFetch<Ticket>("/tickets", { method: "POST", body: JSON.stringify(ticket) }),
  update: (id: string, data: Partial<Ticket>) =>
    apiFetch<Ticket>(`/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/tickets/${id}`, { method: "DELETE" }),
};

// ─── Equipment API ───
export const equipmentApi = {
  getAll: () => apiFetch<Equipment[]>("/equipment"),
  getById: (id: string) => apiFetch<Equipment>(`/equipment/${id}`),
  create: (eq: Omit<Equipment, "id">) =>
    apiFetch<Equipment>("/equipment", { method: "POST", body: JSON.stringify(eq) }),
  update: (id: string, data: Partial<Equipment>) =>
    apiFetch<Equipment>(`/equipment/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/equipment/${id}`, { method: "DELETE" }),
};

// ─── Vehicles API ───
export const vehiclesApi = {
  getAll: () => apiFetch<Vehicle[]>("/vehicles"),
  getById: (id: string) => apiFetch<Vehicle>(`/vehicles/${id}`),
  create: (v: Omit<Vehicle, "id">) =>
    apiFetch<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(v) }),
  update: (id: string, data: Partial<Vehicle>) =>
    apiFetch<Vehicle>(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/vehicles/${id}`, { method: "DELETE" }),
};

// ─── Phone Fleet API ───
export const phonesApi = {
  getAll: () => apiFetch<PhoneDevice[]>("/phones"),
  getById: (id: string) => apiFetch<PhoneDevice>(`/phones/${id}`),
  create: (p: Omit<PhoneDevice, "id">) =>
    apiFetch<PhoneDevice>("/phones", { method: "POST", body: JSON.stringify(p) }),
  update: (id: string, data: Partial<PhoneDevice>) =>
    apiFetch<PhoneDevice>(`/phones/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/phones/${id}`, { method: "DELETE" }),
};

// ─── Armed Personnel API ───
export const personnelApi = {
  getAll: () => apiFetch<ArmedPersonnel[]>("/armed-personnel"),
  getById: (id: string) => apiFetch<ArmedPersonnel>(`/armed-personnel/${id}`),
  create: (p: Omit<ArmedPersonnel, "id">) =>
    apiFetch<ArmedPersonnel>("/armed-personnel", { method: "POST", body: JSON.stringify(p) }),
  update: (id: string, data: Partial<ArmedPersonnel>) =>
    apiFetch<ArmedPersonnel>(`/armed-personnel/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/armed-personnel/${id}`, { method: "DELETE" }),
};

// ─── Notifications API ───
export const notificationsApi = {
  getAll: () => apiFetch<AppNotification[]>("/notifications"),
  getForUser: (userId: string) => apiFetch<AppNotification[]>(`/notifications?userId=${userId}`),
  create: (n: Omit<AppNotification, "id" | "createdAt" | "read">) =>
    apiFetch<AppNotification>("/notifications", { method: "POST", body: JSON.stringify(n) }),
  markRead: (id: string) =>
    apiFetch<void>(`/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: (userId: string) =>
    apiFetch<void>(`/notifications/read-all?userId=${userId}`, { method: "PUT" }),
  delete: (id: string) =>
    apiFetch<void>(`/notifications/${id}`, { method: "DELETE" }),
};

// ─── Purchase Requests API ───
export const purchaseRequestsApi = {
  getAll: () => apiFetch<PurchaseRequest[]>("/purchase-requests"),
  getById: (id: string) => apiFetch<PurchaseRequest>(`/purchase-requests/${id}`),
  create: (pr: Omit<PurchaseRequest, "id">) =>
    apiFetch<PurchaseRequest>("/purchase-requests", { method: "POST", body: JSON.stringify(pr) }),
  update: (id: string, data: Partial<PurchaseRequest>) =>
    apiFetch<PurchaseRequest>(`/purchase-requests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  approve: (id: string, data: { by: string; comment?: string; level: string }) =>
    apiFetch<PurchaseRequest>(`/purchase-requests/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  reject: (id: string, data: { by: string; reason: string }) =>
    apiFetch<PurchaseRequest>(`/purchase-requests/${id}/reject`, { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/purchase-requests/${id}`, { method: "DELETE" }),
};

// ─── Hiring Requests API ───
export const hiringRequestsApi = {
  getAll: () => apiFetch<HiringRequest[]>("/hiring-requests"),
  getById: (id: string) => apiFetch<HiringRequest>(`/hiring-requests/${id}`),
  create: (hr: Omit<HiringRequest, "id">) =>
    apiFetch<HiringRequest>("/hiring-requests", { method: "POST", body: JSON.stringify(hr) }),
  update: (id: string, data: Partial<HiringRequest>) =>
    apiFetch<HiringRequest>(`/hiring-requests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateStatus: (id: string, data: { status: string; by: string; comment?: string }) =>
    apiFetch<HiringRequest>(`/hiring-requests/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/hiring-requests/${id}`, { method: "DELETE" }),
};

// ─── Minor Purchases API ───
export const minorPurchasesApi = {
  getAll: () => apiFetch<MinorPurchase[]>("/minor-purchases"),
  create: (mp: Omit<MinorPurchase, "id">) =>
    apiFetch<MinorPurchase>("/minor-purchases", { method: "POST", body: JSON.stringify(mp) }),
  approve: (id: string, data: { by: string }) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  reject: (id: string, data: { by: string }) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}/reject`, { method: "POST", body: JSON.stringify(data) }),
};

// ─── Registration Requests API ───
export const registrationApi = {
  getAll: () => apiFetch<any[]>("/registration-requests"),
  create: (data: any) =>
    apiFetch<any>("/registration-requests", { method: "POST", body: JSON.stringify(data) }),
  approve: (id: string, data: { by: string }) =>
    apiFetch<any>(`/registration-requests/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  reject: (id: string, data: { by: string; reason: string }) =>
    apiFetch<any>(`/registration-requests/${id}/reject`, { method: "POST", body: JSON.stringify(data) }),
};

export default apiFetch;
