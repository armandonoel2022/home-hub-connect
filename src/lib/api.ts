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
  UniformItem, UniformAssignment, FlashlightItem,
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

// ─── Uniform Items API ───
export const uniformItemsApi = {
  getAll: () => apiFetch<UniformItem[]>("/uniform-items"),
  create: (p: Omit<UniformItem, "id">) =>
    apiFetch<UniformItem>("/uniform-items", { method: "POST", body: JSON.stringify(p) }),
  update: (id: string, data: Partial<UniformItem>) =>
    apiFetch<UniformItem>(`/uniform-items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/uniform-items/${id}`, { method: "DELETE" }),
};

// ─── Uniform Assignments API ───
export const uniformAssignmentsApi = {
  getAll: () => apiFetch<UniformAssignment[]>("/uniform-assignments"),
  create: (p: Omit<UniformAssignment, "id">) =>
    apiFetch<UniformAssignment>("/uniform-assignments", { method: "POST", body: JSON.stringify(p) }),
  update: (id: string, data: Partial<UniformAssignment>) =>
    apiFetch<UniformAssignment>(`/uniform-assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/uniform-assignments/${id}`, { method: "DELETE" }),
};

// ─── Flashlights API ───
export const flashlightsApi = {
  getAll: () => apiFetch<FlashlightItem[]>("/flashlights"),
  create: (p: Omit<FlashlightItem, "id">) =>
    apiFetch<FlashlightItem>("/flashlights", { method: "POST", body: JSON.stringify(p) }),
  update: (id: string, data: Partial<FlashlightItem>) =>
    apiFetch<FlashlightItem>(`/flashlights/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/flashlights/${id}`, { method: "DELETE" }),
};

// ─── Photo Sync API ───
export interface PhotoMatch {
  file: string;
  url: string;
  normalized: string;
  cleanedName: string;
  score: number;
  exact: boolean;
}
export interface PhotoSyncScan {
  photosDir: string;
  photoSources?: Array<{ dir: string; base: string }>;
  photosCount: number;
  publicBase: string;
  employees: Array<{ employeeCode: string; fullName: string; department?: string; currentPhoto: string | null; match: PhotoMatch | null }>;
  armed: Array<{ id: string; employeeCode?: string; fullName: string; currentPhoto: string | null; hasGallery: boolean; match: PhotoMatch | null }>;
  users: Array<{ id: string; fullName: string; email: string; currentPhoto: string | null; match: PhotoMatch | null }>;
  unmatchedFiles: PhotoMatch[];
  counts: {
    employees: { total: number; matched: number };
    armed: { total: number; matched: number };
    users: { total: number; matched: number };
  };
}
export const photoSyncApi = {
  scan: () => apiFetch<PhotoSyncScan>("/photo-sync/scan"),
  apply: (body: {
    employees?: Array<{ employeeCode: string; url: string }>;
    armed?: Array<{ id: string; url: string; fullName?: string }>;
    users?: Array<{ id: string; url: string }>;
    overwrite?: boolean;
    uploadedBy?: string;
  }) => apiFetch<{ ok: boolean; empUpdated: number; armedUpdated: number; usersUpdated: number }>(
    "/photo-sync/apply",
    { method: "POST", body: JSON.stringify(body) }
  ),
  find: (name: string, extra?: { employeeCode?: string; cedula?: string; tss?: string }) => {
    const qs = new URLSearchParams({ name });
    if (extra?.employeeCode) qs.set("employeeCode", extra.employeeCode);
    if (extra?.cedula) qs.set("cedula", extra.cedula);
    if (extra?.tss) qs.set("tss", extra.tss);
    return apiFetch<{ match: { url: string; file: string; score: number } | null }>(`/photo-sync/find?${qs.toString()}`);
  },
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
  reassignId: (id: string, data: { newId: string; reason: string; by: string }) =>
    apiFetch<MinorPurchase>(`/minor-purchases/${id}/reassign-id`, { method: "POST", body: JSON.stringify(data) }),
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
  purchaseId?: string;
  purchaseDescription?: string;
  purchaseIds?: string[];
  kind?: "mensual" | "transaccion";
  note?: string;
}
export interface PettyCashState {
  repositions: MonthlyReposition[];
  denominations: { value: number; count: number }[];
}
export const pettyCashApi = {
  getState: () => apiFetch<PettyCashState>("/petty-cash"),
  createReposition: (data: {
    yearMonth: string;
    amountReposed: number;
    requestedBy: string;
    purchaseId?: string;
    purchaseDescription?: string;
    purchaseIds?: string[];
    note?: string;
  }) =>
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

// ─── Benefits API (RRHH) ───
export const benefitsApi = {
  getAll: () => apiFetch<any[]>("/benefits"),
  create: (benefit: any) =>
    apiFetch<any>("/benefits", { method: "POST", body: JSON.stringify(benefit) }),
  update: (id: string, data: any) =>
    apiFetch<any>(`/benefits/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/benefits/${id}`, { method: "DELETE" }),
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
  addFile: (department: string, folderId: string, data: { name: string; size: string; fileData?: string }) =>
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

// ─── Training (Capacitaciones BASC) API ───
import type { TrainingEnrollment, TrainingCertificate } from "./trainingTypes";

export const trainingApi = {
  // Enrollments
  getEnrollments: (userId?: string) =>
    apiFetch<TrainingEnrollment[]>(`/training/enrollments${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),
  saveEnrollment: (data: { userId: string; courseId: string; currentSection: number; sectionsRead: number[]; status: string }) =>
    apiFetch<TrainingEnrollment>("/training/enrollments", { method: "POST", body: JSON.stringify(data) }),
  // Attempts (quiz/confirm) → certificate
  submitAttempt: (data: {
    userId: string; courseId: string; mode: "quiz" | "confirm";
    answers?: number[]; score?: number | null; passed: boolean;
    fullName: string; position: string; department: string;
  }) =>
    apiFetch<{ enrollment: TrainingEnrollment; attempt: any; certificate: TrainingCertificate | null }>(
      "/training/attempts", { method: "POST", body: JSON.stringify(data) }
    ),
  // Certificates
  getCertificates: (userId?: string) =>
    apiFetch<TrainingCertificate[]>(`/training/certificates${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),
  // PINs (RRHH/Admin)
  getPins: () => apiFetch<Record<string, string>>("/training/pins"),
  setPin: (userId: string, pin: string) =>
    apiFetch<{ userId: string; pin: string }>(`/training/pins/${encodeURIComponent(userId)}`, {
      method: "PUT", body: JSON.stringify({ pin }),
    }),
  // Kiosk login (no auth required)
  kioskLogin: (employeeCode: string, pin: string) =>
    apiFetch<{ user: { id: string; fullName: string; position: string; department: string } }>(
      "/training/kiosk-login", { method: "POST", body: JSON.stringify({ employeeCode, pin }) }
    ),
};

// ─── Employees API (HR Directory) ───
export interface Employee {
  employeeCode: string;
  fullName: string;
  status: string;
  payrollType: string;
  category?: string; // Administrativo | Supervisor | Vigilante | Operador
  department: string;
  position: string;
  bank: string;
  salary: number;
  hourlyRate: number;
  /** Cédula (campo histórico llamado tss en el seed) */
  tss?: string;
  /** Cédula oficial (nueva columna) */
  cedula?: string;
  /** Email corporativo opcional para envío de volante */
  email?: string;
  hireDate?: string;
  /** Fecha de nacimiento ISO (YYYY-MM-DD) */
  birthDate?: string;
  /** Cumpleaños MM-DD precomputado para overlay */
  birthdayMMDD?: string;
  birthday?: string;
  /** Foto del empleado (URL absoluta, base64 o ruta relativa /photos/...) */
  photoUrl?: string;
  photo?: string;
  photoUpdatedAt?: string;
  photoUpdatedBy?: string;
  updatedAt?: string;
  // ─── Cumplimiento TSS (gestión manual) ───
  /** ¿Está registrado en la TSS con descuentos de ley? */
  tssRegistered?: boolean;
  /** Salario reportado a la TSS (puede diferir del salario interno) */
  tssReportedSalary?: number;
  /** Fecha en que se confirmó el registro TSS */
  tssRegisteredAt?: string;
  /** Notas internas del estado TSS */
  tssNotes?: string;
  /** Solicitud pendiente de baja en TSS (cuando empleado dejó de ser activo) */
  tssPendingUnregister?: boolean;
  tssPendingUnregisterAt?: string;
  tssPendingUnregisterReason?: string;
  // ─── Organigrama / Dashboard de Departamentos ───
  /** ¿Es el líder del departamento (dashboard)? */
  isDeptLeader?: boolean;
  /** Código de empleado del líder al que se reporta (para armar el equipo) */
  reportsToCode?: string;
  /** Extensión telefónica interna */
  extension?: string;
  /** Equipo asignado (puesto/cliente) */
  team?: string;
  /** Turno de trabajo */
  shift?: string;
}

export const employeesApi = {
  getAll: (params?: { department?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department) qs.set("department", params.department);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return apiFetch<Employee[]>(`/employees${q ? `?${q}` : ""}`);
  },
  getStats: () => apiFetch<{ total: number; byDepartment: Record<string, number>; byPayrollType: Record<string, number> }>("/employees/stats"),
  getOne: (code: string) => apiFetch<Employee>(`/employees/${encodeURIComponent(code)}`),
  update: (code: string, data: Partial<Employee>) =>
    apiFetch<Employee>(`/employees/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(data) }),
  create: (data: Partial<Employee>) =>
    apiFetch<Employee>("/employees", { method: "POST", body: JSON.stringify(data) }),
  remove: (code: string) =>
    apiFetch<{}>(`/employees/${encodeURIComponent(code)}`, { method: "DELETE" }),
};

// ─── Payroll & TSS Compliance ───
export interface TssImportMeta {
  id: string;
  period: string;
  importedAt: string;
  importedBy: string;
  rowCount: number;
}
export interface TssCompareSummary {
  activeEmployees: number;
  tssReported: number;
  matched: number;
  missingTss: number;
  ghostTss: number;
  salaryMismatch: number;
}
export interface TssCompareResult {
  period: string;
  importedAt: string;
  summary: TssCompareSummary;
  matched: any[];
  missingTss: any[];
  ghostTss: any[];
  salaryMismatch: any[];
}
export interface MealDetailItem { date: string; description: string; amount: number; }
export interface PayrollItem {
  employeeCode: string;
  fullName: string;
  cedula: string;
  department: string;
  position: string;
  bank: string;
  category: string;
  hireDate?: string;
  isSecurityAgent?: boolean;
  monthlyDivisor?: number;
  normalDailyHours?: number;
  hourlyRate?: number;
  grossMonthly: number;
  grossPeriodBase?: number;
  overtimeHours?: number;
  overtimeAmount?: number;
  nightHours?: number;
  nightAmount?: number;
  holidayDays?: number;
  holidayAmount?: number;
  mealDeduction?: number;
  mealDetail?: MealDetailItem[];
  lateHours?: number;
  lateDeduction?: number;
  incentiveAmount?: number;
  incentiveDetail?: MealDetailItem[];
  loanDeduction?: number;
  loanDetail?: { id: string; installment: number; frequency?: string }[];
  grossPeriod: number;
  sfs: number;
  afp: number;
  isr: number;
  totalDeductions: number;
  net: number;
}
export interface PayrollRun {
  id: string;
  period: string;
  payDate: string;
  schedule: "admin" | "ops";
  frequency: "monthly" | "quincenal";
  scope: "all" | "category" | "selected";
  createdAt: string;
  createdBy: string;
  closed: boolean;
  closedAt?: string;
  items: PayrollItem[];
  totals: { gross: number; sfs: number; afp: number; isr: number; overtime?: number; night?: number; holiday?: number; meals?: number; deductions: number; net: number; count: number };
}

export interface PayrollExtra {
  id: string;
  employeeCode: string;
  employeeName: string;
  type: "overtime" | "night" | "holiday" | "meal" | "late" | "incentive";
  date: string;
  hours?: number;
  days?: number;
  amount?: number;
  description?: string;
  registeredBy: string;
  registeredAt: string;
  status: "Pendiente RRHH" | "Procesada";
  payrollRunId?: string;
}

export const payrollExtrasApi = {
  list: (params?: { employeeCode?: string; period?: string; status?: string; type?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch<PayrollExtra[]>(`/payroll-extras${q ? "?" + q : ""}`);
  },
  create: (data: Partial<PayrollExtra>) =>
    apiFetch<PayrollExtra>("/payroll-extras", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PayrollExtra>) =>
    apiFetch<PayrollExtra>(`/payroll-extras/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/payroll-extras/${id}`, { method: "DELETE" }),
};

export const payrollApi = {
  importTss: (data: { period: string; rows: any[] }) =>
    apiFetch<{ ok: boolean; period: string; count: number }>("/payroll/tss/import", { method: "POST", body: JSON.stringify(data) }),
  listTss: () => apiFetch<TssImportMeta[]>("/payroll/tss"),
  getTss: (period: string) => apiFetch<any>(`/payroll/tss/${encodeURIComponent(period)}`),
  deleteTss: (period: string) => apiFetch<void>(`/payroll/tss/${encodeURIComponent(period)}`, { method: "DELETE" }),
  compareTss: (period: string) => apiFetch<TssCompareResult>(`/payroll/tss/${encodeURIComponent(period)}/compare`),
  generateRun: (data: { period: string; payDate: string; schedule: "admin" | "ops"; scope: "all" | "category" | "selected"; selectedCodes?: string[]; frequency: "monthly" | "quincenal" }) =>
    apiFetch<PayrollRun>("/payroll/runs/generate", { method: "POST", body: JSON.stringify(data) }),
  listRuns: () => apiFetch<(Omit<PayrollRun, "items"> & { itemCount: number })[]>("/payroll/runs"),
  getRun: (id: string) => apiFetch<PayrollRun>(`/payroll/runs/${id}`),
  closeRun: (id: string) => apiFetch<PayrollRun>(`/payroll/runs/${id}/close`, { method: "POST" }),
  deleteRun: (id: string) => apiFetch<void>(`/payroll/runs/${id}`, { method: "DELETE" }),
  sendPayslip: (data: { runId: string; employeeCode: string; recipientEmail?: string }) =>
    apiFetch<{ ok: boolean; log: any }>("/payroll/payslips/send", { method: "POST", body: JSON.stringify(data) }),
  getPayslipLog: () => apiFetch<any[]>("/payroll/payslips/log"),
};

export interface MonitoringReportMeta {
  id: string;
  kind: "kronos" | "punches";
  reportDate: string;
  fileName?: string;
  uploadedAt: string;
  uploadedBy: string;
  hasPayload?: boolean;
}
export interface MonitoringReportDoc<T = any> extends MonitoringReportMeta {
  payload: T;
}

export const monitoringReportsApi = {
  list: (kind: "kronos" | "punches") =>
    apiFetch<MonitoringReportMeta[]>(`/monitoring-reports?kind=${kind}`),
  get: <T = any>(id: string) => apiFetch<MonitoringReportDoc<T>>(`/monitoring-reports/${id}`),
  upsert: <T = any>(data: { kind: "kronos" | "punches"; reportDate: string; fileName?: string; payload: T }) =>
    apiFetch<MonitoringReportDoc<T>>("/monitoring-reports", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/monitoring-reports/${id}`, { method: "DELETE" }),
};

// ─── Configuración persistente por LX (cuenta Kronos) ───
export type MonitoringAccountKind = "regular" | "panic";
/** Legacy. Mantener por compatibilidad de tipos en código existente. */
export type MonitoringManualStatus =
  | "Activo" | "Inactivo" | "Sin notificaciones"
  | "Dado de baja" | "Cancelado" | "Suspendido por falta de pago";
/** Estado actual de la LX. Reemplaza a manualStatus. */
export type LxStatus =
  | "Activa" | "Prueba" | "Cancelada" | "Suspendida"
  | "Dada de baja" | "Sin notificaciones" | "Inactiva";

/** Tipo de servicio operativo de la cuenta */
export type ServiceType =
  | "Monitoreado sin respuesta"
  | "Monitoreado con Respuesta"
  | "Botón de pánico"
  | "Interrupción Energética"
  | "Active Track"
  | "Panel de Incendio";
/** Tipo de comunicación del panel */
export type CommType = "EBS LX-EPX" | "Intelbras";
/** Marca del equipo asociado */
export type BrandType = "Hikvision" | "Daiwa";

export interface MonitoringAccountSetting {
  accountCode: string;
  accountName?: string;
  clientId?: string | null;
  kind: MonitoringAccountKind;
  lxStatus: LxStatus | null;
  /** @deprecated usar lxStatus */
  manualStatus?: MonitoringManualStatus | null;
  serviceType?: ServiceType | null;
  commType?: CommType | null;
  brand?: BrandType | null;
  locationAddress?: string;
  locationMapsUrl?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  expectedOpen: string | null;
  expectedClose: string | null;
  notes: string;
  /** ID del operador asignado (ver src/lib/monitoringOperators.ts) */
  operatorId?: string | null;
  updatedAt: string;
  updatedBy: string;
}

export const monitoringAccountSettingsApi = {
  list: () => apiFetch<MonitoringAccountSetting[]>("/monitoring-account-settings"),
  upsert: (accountCode: string, data: Partial<MonitoringAccountSetting>) =>
    apiFetch<MonitoringAccountSetting>(`/monitoring-account-settings/${encodeURIComponent(accountCode)}`,
      { method: "PUT", body: JSON.stringify(data) }),
  remove: (accountCode: string) =>
    apiFetch<void>(`/monitoring-account-settings/${encodeURIComponent(accountCode)}`, { method: "DELETE" }),
};

// ─── Catálogo maestro de Clientes facturados (Cuentas por Cobrar) ───
export interface BillingClient {
  id: string;
  code: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  locationAddress?: string;
  locationMapsUrl?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export const billingClientsApi = {
  list: () => apiFetch<BillingClient[]>("/billing-clients"),
  create: (data: Partial<BillingClient>) =>
    apiFetch<BillingClient>("/billing-clients", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<BillingClient>) =>
    apiFetch<BillingClient>(`/billing-clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/billing-clients/${id}`, { method: "DELETE" }),
  bulkImport: (items: Partial<BillingClient>[], mode: "upsert" | "replace" = "upsert") =>
    apiFetch<{ ok: boolean; mode: string; created: number; updated: number; skipped: number; total: number }>(
      "/billing-clients/bulk-import", { method: "POST", body: JSON.stringify({ items, mode }) }),
};

// ─── Reglas de rondas (punches) por cliente ───
export interface PunchRoundConfig {
  time: string;          // "HH:MM"
  toleranceMin: number;  // ±min para considerar cumplida
  precisionMin: number;  // ±min para considerar "preciso" (subset del tolerance)
}
export interface PunchRule {
  id: string;
  clientPattern: string;
  label: string;
  rounds: PunchRoundConfig[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export const punchRulesApi = {
  list: () => apiFetch<PunchRule[]>("/monitoring-punch-rules"),
  create: (data: Pick<PunchRule, "clientPattern" | "label" | "rounds" | "active">) =>
    apiFetch<PunchRule>("/monitoring-punch-rules", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PunchRule>) =>
    apiFetch<PunchRule>(`/monitoring-punch-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/monitoring-punch-rules/${id}`, { method: "DELETE" }),
};

// ─── Snapshots históricos del servicio ───
export interface MonitoringSnapshotMetrics {
  totalLx: number;
  activeLx: number;
  billableLx: number;
  compliedCycle: number;
  compliedCyclePct: number;
  noSignalHigh: number;
  activeTrackTotal: number;
  activeTrackComplied: number;
  activeTrackPct: number;
  incidentsOpen: number;
  incidentsResolved: number;
}
export interface MonitoringSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  source: "kronos" | "punch" | "manual" | "auto-close";
  metrics: MonitoringSnapshotMetrics;
  createdAt: string;
  createdBy: string;
}
export const monitoringSnapshotsApi = {
  list: (params?: { from?: string; to?: string; source?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.source) q.set("source", params.source);
    const qs = q.toString();
    return apiFetch<MonitoringSnapshot[]>(`/monitoring-snapshots${qs ? `?${qs}` : ""}`);
  },
  upsert: (data: { date: string; source: MonitoringSnapshot["source"]; metrics: MonitoringSnapshotMetrics }) =>
    apiFetch<MonitoringSnapshot>("/monitoring-snapshots", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/monitoring-snapshots/${id}`, { method: "DELETE" }),
};

// ─── Folder ACL (administrada por superusuario) ───
export type FolderAcl = Record<string, { viewers: string[]; editors: string[]; updatedAt?: string; updatedBy?: string }>;
export const folderAclApi = {
  getAll: () => apiFetch<FolderAcl>("/folder-acl"),
  setDepartment: (department: string, data: { viewers: string[]; editors: string[] }) =>
    apiFetch(`/folder-acl/${encodeURIComponent(department)}`, { method: "PUT", body: JSON.stringify(data) }),
  clearDepartment: (department: string) =>
    apiFetch<void>(`/folder-acl/${encodeURIComponent(department)}`, { method: "DELETE" }),
};

// ─── Announcements (overlay global + evento opcional en calendario) ───
export interface AnnouncementApi {
  id: string;
  title: string;
  excerpt: string;
  priority: boolean;
  date: string;
  createdBy: string;
  createdByUserId?: string;
  audienceType: "todos" | "departamento" | "personas";
  audienceDept?: string;
  audienceUserIds?: string[];
  showAsOverlay?: boolean;
  eventDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  eventLocation?: string;
  expiresAt?: string;
  readBy?: string[];
}
export const announcementsApi = {
  getAll: () => apiFetch<AnnouncementApi[]>("/announcements"),
  getActive: () => apiFetch<AnnouncementApi[]>("/announcements/active"),
  create: (a: Partial<AnnouncementApi>) =>
    apiFetch<AnnouncementApi>("/announcements", { method: "POST", body: JSON.stringify(a) }),
  markRead: (id: string) =>
    apiFetch<{ ok: boolean }>(`/announcements/${id}/read`, { method: "PUT" }),
  remove: (id: string) =>
    apiFetch<void>(`/announcements/${id}`, { method: "DELETE" }),
};

// ─── HR Requests (persistencia compartida) ───
export const hrRequestsApi = {
  list: () => apiFetch<any[]>("/hr-requests"),
  replaceAll: (items: any[]) =>
    apiFetch<{ ok: boolean; count: number }>("/hr-requests", { method: "PUT", body: JSON.stringify(items) }),
  upsert: (id: string, record: any) =>
    apiFetch<any>(`/hr-requests/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(record) }),
  remove: (id: string) =>
    apiFetch<void>(`/hr-requests/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listNotifications: () => apiFetch<any[]>("/hr-requests/notifications/all"),
  replaceAllNotifications: (items: any[]) =>
    apiFetch<{ ok: boolean; count: number }>("/hr-requests/notifications/all", { method: "PUT", body: JSON.stringify(items) }),
};

export default apiFetch;




