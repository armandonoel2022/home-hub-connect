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
  // Skip auto-detection for Lovable preview/cloud domains
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    const host = window.location.hostname;
    if (host.includes('lovableproject.com') || host.includes('lovable.app') || host.includes('lovable.dev')) {
      return "";
    }
    return `http://${host}:3000/api`;
  }
  return "";
}

const BASE_URL = getBaseUrl();

/** Returns true when a backend API URL is configured */
export const isApiConfigured = () => !!BASE_URL;

/** Build full URL for a file served by the backend (e.g. /uploads/chat/MSG-001.pdf) */
export function getFileUrl(relativePath: string): string {
  if (!relativePath) return "";
  // Already absolute URL
  if (relativePath.startsWith("http") || relativePath.startsWith("data:")) return relativePath;
  // Build from API base (remove /api suffix)
  const serverBase = BASE_URL.replace(/\/api\/?$/, "");
  return `${serverBase}${relativePath}`;
}

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
    apiFetch<{ token: string; user: IntranetUser; mustChangePassword?: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => {
    const token = localStorage.getItem("safeone_token");
    localStorage.removeItem("safeone_token");
    localStorage.removeItem("safeone_user");
    if (BASE_URL && token) {
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
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  forgotPassword: (email: string, fullName?: string) =>
    apiFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, fullName }),
    }),
  getPasswordResetRequests: () =>
    apiFetch<any[]>("/auth/password-reset-requests"),
  adminResetPassword: (userId: string, tempPassword: string) =>
    apiFetch<{ message: string }>(`/auth/admin-reset-password/${userId}`, {
      method: "POST",
      body: JSON.stringify({ tempPassword }),
    }),
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
  update: (id: string, data: Partial<MinorPurchase>) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    apiFetch<void>(`/minor-purchases/${id}`, { method: "DELETE" }),
  approve: (id: string, data: { by: string }) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  reject: (id: string, data: { by: string }) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}/reject`, { method: "POST", body: JSON.stringify(data) }),
  voidPurchase: (id: string, data: { by: string; reason: string }) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}/void`, { method: "POST", body: JSON.stringify(data) }),
  uploadReceipt: (id: string, dataUrl: string, fileName: string) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}/receipt`, { method: "POST", body: JSON.stringify({ dataUrl, fileName }) }),
};

// ─── Petty Cash (repositions + denominations) ───
export interface MonthlyReposition {
  id: string;
  yearMonth: string;
  amountReposed: number;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  appliedBy?: string;
  appliedAt?: string;
  status: "pendiente" | "aprobado" | "aplicado";
}
export interface PettyCashState {
  repositions: MonthlyReposition[];
  denominations: { value: number; count: number }[];
}
export const pettyCashApi = {
  getState: () => apiFetch<PettyCashState>("/petty-cash"),
  createReposition: (data: { yearMonth: string; amountReposed: number; requestedBy: string }) =>
    apiFetch<MonthlyReposition>("/petty-cash/repositions", { method: "POST", body: JSON.stringify(data) }),
  approveReposition: (id: string, by: string) =>
    apiFetch<MonthlyReposition>(`/petty-cash/repositions/${id}/approve`, { method: "POST", body: JSON.stringify({ by }) }),
  applyReposition: (id: string, by: string) =>
    apiFetch<MonthlyReposition>(`/petty-cash/repositions/${id}/apply`, { method: "POST", body: JSON.stringify({ by }) }),
  removeReposition: (id: string) =>
    apiFetch<void>(`/petty-cash/repositions/${id}`, { method: "DELETE" }),
  updateDenominations: (denominations: { value: number; count: number }[]) =>
    apiFetch<{ value: number; count: number }[]>(`/petty-cash/denominations`, {
      method: "PUT",
      body: JSON.stringify({ denominations }),
    }),
};

// ─── Corporate Cards ───
export interface CorporateCard {
  id: string;
  holder: string;
  holderUserId: string | null;
  last4: string;
  brand: string;
  monthlyLimit: number;
  department: string;
  notes: string;
  active: boolean;
  createdAt: string;
}
export interface CardCharge {
  id: string;
  cardId: string;
  expenseDate: string;
  description: string;
  amount: number;
  category: string;
  merchant: string;
  notes: string;
  registeredBy: string;
  registeredAt: string;
  receiptUrl: string;
  receiptName: string;
  voided?: boolean;
  voidedReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}
export const corporateCardsApi = {
  getState: () => apiFetch<{ cards: CorporateCard[]; charges: CardCharge[] }>("/corporate-cards"),
  createCard: (data: Partial<CorporateCard>) =>
    apiFetch<CorporateCard>("/corporate-cards/cards", { method: "POST", body: JSON.stringify(data) }),
  updateCard: (id: string, data: Partial<CorporateCard>) =>
    apiFetch<CorporateCard>(`/corporate-cards/cards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  removeCard: (id: string) =>
    apiFetch<void>(`/corporate-cards/cards/${id}`, { method: "DELETE" }),
  createCharge: (data: Partial<CardCharge> & { receiptDataUrl?: string; receiptName?: string }) =>
    apiFetch<CardCharge>("/corporate-cards/charges", { method: "POST", body: JSON.stringify(data) }),
  updateCharge: (id: string, data: Partial<CardCharge>) =>
    apiFetch<CardCharge>(`/corporate-cards/charges/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  voidCharge: (id: string, by: string, reason: string) =>
    apiFetch<CardCharge>(`/corporate-cards/charges/${id}/void`, { method: "POST", body: JSON.stringify({ by, reason }) }),
  removeCharge: (id: string) =>
    apiFetch<void>(`/corporate-cards/charges/${id}`, { method: "DELETE" }),
};

// ─── KPIs API ───
export const kpisApi = {
  getObjectives: () => apiFetch<any[]>("/kpis/objectives"),
  updateObjective: (id: string, data: any) =>
    apiFetch<any>(`/kpis/objectives/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getDeptKPIs: () => apiFetch<any[]>("/kpis/department"),
  createDeptKPI: (kpi: any) =>
    apiFetch<any>("/kpis/department", { method: "POST", body: JSON.stringify(kpi) }),
  updateDeptKPI: (id: string, data: any) =>
    apiFetch<any>(`/kpis/department/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDeptKPI: (id: string) =>
    apiFetch<void>(`/kpis/department/${id}`, { method: "DELETE" }),
};

// ─── Tasks API ───
export const tasksApi = {
  getAll: () => apiFetch<any[]>("/tasks"),
  getById: (id: string) => apiFetch<any>(`/tasks/${id}`),
  create: (task: any) =>
    apiFetch<any>("/tasks", { method: "POST", body: JSON.stringify(task) }),
  update: (id: string, data: any) =>
    apiFetch<any>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/tasks/${id}`, { method: "DELETE" }),
};

// ─── Department Folders API ───
export const departmentFoldersApi = {
  getFolders: (department: string) =>
    apiFetch<any[]>(`/department-folders/${encodeURIComponent(department)}`),
  createFolder: (department: string, name: string) =>
    apiFetch<any>(`/department-folders/${encodeURIComponent(department)}`, {
      method: "POST", body: JSON.stringify({ name }),
    }),
  deleteFolder: (department: string, folderId: string) =>
    apiFetch<void>(`/department-folders/${encodeURIComponent(department)}/${folderId}`, { method: "DELETE" }),
  addFile: (department: string, folderId: string, data: { name: string; size: string }) =>
    apiFetch<any>(`/department-folders/${encodeURIComponent(department)}/${folderId}/files`, {
      method: "POST", body: JSON.stringify(data),
    }),
  deleteFile: (department: string, folderId: string, fileId: string) =>
    apiFetch<void>(`/department-folders/${encodeURIComponent(department)}/${folderId}/files/${fileId}`, { method: "DELETE" }),
};

// ─── Chat API ───
import type { Chat, ChatMessage } from "./chatTypes";

export const chatApi = {
  getChats: () => apiFetch<Chat[]>("/chat/chats"),
  findOrCreateChat: (data: { type: string; name: string; participants: string[]; departmentId?: string }) =>
    apiFetch<Chat>("/chat/chats", { method: "POST", body: JSON.stringify(data) }),
  getMessages: (chatId: string, since?: string) =>
    apiFetch<ChatMessage[]>(`/chat/messages/${chatId}${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  sendMessage: (data: { chatId: string; content: string; type: string; senderName: string; fileName?: string; fileData?: string }) =>
    apiFetch<ChatMessage>("/chat/messages", { method: "POST", body: JSON.stringify(data) }),
  poll: (since: string) =>
    apiFetch<{ messages: ChatMessage[]; chats: Chat[] }>(`/chat/poll?since=${encodeURIComponent(since)}`),
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

// ─── Department Processes API ───
export const processesApi = {
  getAll: () => apiFetch<any[]>("/department-processes"),
  getByDepartment: (dept: string) => apiFetch<any[]>(`/department-processes?department=${encodeURIComponent(dept)}`),
  getById: (id: string) => apiFetch<any>(`/department-processes/${id}`),
  create: (data: any) =>
    apiFetch<any>("/department-processes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiFetch<any>(`/department-processes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/department-processes/${id}`, { method: "DELETE" }),
  updateChecklist: (id: string, checklist: any[]) =>
    apiFetch<any>(`/department-processes/${id}/checklist`, { method: "PUT", body: JSON.stringify({ checklist }) }),
};

// ─── Fleet Maintenance API ───
export const fleetMaintenanceApi = {
  getAll: () => apiFetch<any>("/fleet-maintenance"),
  createEntry: (entry: any) =>
    apiFetch<any>("/fleet-maintenance/maintenance", { method: "POST", body: JSON.stringify(entry) }),
  updateEntry: (id: string, data: any) =>
    apiFetch<any>(`/fleet-maintenance/maintenance/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEntry: (id: string) =>
    apiFetch<void>(`/fleet-maintenance/maintenance/${id}`, { method: "DELETE" }),
  createUnit: (u: any) =>
    apiFetch<any>("/fleet-maintenance/fleet", { method: "POST", body: JSON.stringify(u) }),
  updateUnit: (placa: string, data: any) =>
    apiFetch<any>(`/fleet-maintenance/fleet/${encodeURIComponent(placa)}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUnit: (placa: string) =>
    apiFetch<void>(`/fleet-maintenance/fleet/${encodeURIComponent(placa)}`, { method: "DELETE" }),
  normalizeTalleres: () =>
    apiFetch<{ changed: number }>("/fleet-maintenance/normalize-talleres", { method: "POST" }),
};

// ─── Audit Log API ───
export const auditApi = {
  getAll: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters || {});
    return apiFetch<any[]>(`/audit-log?${params.toString()}`);
  },
  create: (entry: any) =>
    apiFetch<any>("/audit-log", { method: "POST", body: JSON.stringify(entry) }),
  getStats: () => apiFetch<any>("/audit-log/stats"),
};

export default apiFetch;
