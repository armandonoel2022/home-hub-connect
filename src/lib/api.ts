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
    const err = await res.json().catch(() => ({ message: "No autorizado" }));
    const isCredentialValidation = endpoint === "/auth/login" || endpoint === "/auth/change-password";

    // Invalid login/current-password credentials are form validation errors, not
    // evidence that the active JWT is expired. Clearing it here caused a logout
    // immediately after the forced password-change flow.
    if (!isCredentialValidation) {
      localStorage.removeItem("safeone_token");
      localStorage.removeItem("safeone_user");
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = "/login";
      }
    }
    throw new Error(err.message || "No autorizado");
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
    apiFetch<{ message: string; user: IntranetUser }>("/auth/change-password", {
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
  getBirthdayPhotoOverrides: () => apiFetch<Record<string, { photoUrl: string; fullName?: string; updatedAt?: string }>>("/users/birthday-photo-overrides"),
  updateBrandonBirthdayPhoto: (photoDataUrl: string, fileName?: string) =>
    apiFetch<{ photoUrl: string; fullName?: string; updatedAt?: string }>("/users/birthday-photo-overrides/brandon", {
      method: "PUT",
      body: JSON.stringify({ photoDataUrl, fileName }),
    }),
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

// ─── Flotilla Vehicular (registro completo) ───
export const fleetVehiclesApi = {
  getAll: (includeInactive = false) =>
    apiFetch<any[]>(`/fleet-vehicles${includeInactive ? "?includeInactive=1" : ""}`),
  create: (v: any) =>
    apiFetch<any>("/fleet-vehicles", { method: "POST", body: JSON.stringify(v) }),
  update: (id: string, data: any) =>
    apiFetch<any>(`/fleet-vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string, motivo?: string, usuario?: string) =>
    apiFetch<any>(
      `/fleet-vehicles/${id}?motivo=${encodeURIComponent(motivo || "")}&usuario=${encodeURIComponent(usuario || "")}`,
      { method: "DELETE" }
    ),
  assignments: () => apiFetch<any[]>("/fleet-vehicles/asignaciones"),
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

// ─── Encuestas (clima laboral) — enlace público + overlay ───
export interface SurveyQuestionApi {
  id: string;
  text: string;
  type: "rating" | "multiple" | "text";
  options?: string[];
}
export interface SurveyApi {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestionApi[];
  status: "activa" | "cerrada";
  isPublic?: boolean;
  showAsOverlay?: boolean;
  startDate?: string;
  endDate?: string;
  reappearMinutes?: number;
  enforced?: boolean;
  createdBy?: string;
  createdAt?: string;
  responses?: any[];
  resultsVisibleTo?: string[];
}

/** Fetch público (sin token, sin redirección a login) para encuestas por enlace */
async function publicFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (!BASE_URL) throw new Error("API_NOT_CONFIGURED");
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Error del servidor" }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export const surveysApi = {
  // Autenticado
  getAll: () => apiFetch<SurveyApi[]>("/surveys"),
  create: (s: Partial<SurveyApi>) =>
    apiFetch<SurveyApi>("/surveys", { method: "POST", body: JSON.stringify(s) }),
  update: (id: string, s: Partial<SurveyApi>) =>
    apiFetch<SurveyApi>(`/surveys/${id}`, { method: "PUT", body: JSON.stringify(s) }),
  remove: (id: string, reason?: string) =>
    apiFetch<void>(`/surveys/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  // Público
  getActiveOverlay: () => publicFetch<SurveyApi[]>("/surveys/public/active"),
  getPublic: (id: string) => publicFetch<SurveyApi>(`/surveys/public/${id}`),
  respond: (id: string, payload: { answers: Record<string, string | number>; userId?: string; userName?: string; department?: string }) =>
    publicFetch<{ ok: boolean }>(`/surveys/public/${id}/respond`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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

// ─── GENERAL (gSafeOne) — Nómina Analítica (solo lectura) ───
export interface GeneralSqlStatus {
  configured: boolean;
  connected: boolean;
  writeEnabled?: boolean;
  auth?: string;
  host?: string | null;
  database?: string | null;
  message?: string;
}
export interface GeneralPeriod {
  OID: number | string;
  Fecha?: string;
  Mes?: number;
  Ano?: number;
  Cerrado?: boolean;
  FechaDesde?: string;
  FechaHasta?: string;
  Nomina?: string;
}
export interface PayrollAnalysis {
  generatedAt: string;
  summary: {
    empleados: number; brutoTotal: number; netoTotal: number;
    deduccionesTotal: number; anomalias: number; anomaliasAltas: number;
  };
  anomalies: Array<{
    severity: "high" | "medium" | "info"; type: string; empleado: string;
    codigo: string; departamento?: any; message: string; delta?: number;
  }>;
  reconciliation: {
    summary: { total: number; ok: number; discrepancia: number; faltanteExcel: number; noReportado: number };
    rows: Array<{
      empleado: string; reportadoExtra: number; excelExtra: number; difExtra: number;
      reportadoFeriado: number; excelFeriado: number; difFeriado: number; status: string;
    }>;
  };
  history: Array<{ label: string; total: number; projected?: boolean }>;
  prediction: {
    trend: string; slope: number; avgGrowthPct?: number; r2: number;
    projection: Array<{ label: string; total: number; projected?: boolean }>;
  };
  items?: PayrollEmployeeItem[];
  meta?: { amountColumn: string | null; filteredTipoPago: boolean };
}
export interface PayrollEmployeeItem {
  empleadoOID: number | string;
  codigo?: string;
  nombre: string;
  departamento?: any;
  salario: number;
  bruto: number;
  deducciones: number;
  neto: number;
  lineas: number;
}
export interface PayrollHistoryEntry {
  pagoOID: number | string; ano?: number; mes?: number; fecha?: string;
  tipoPago?: number | null; monto: number; lineas: number;
}
export interface GeneralActiveEmployee {
  oid: number;
  codigo: string | null;
  nombre1: string | null;
  nombre2: string | null;
  apellido1: string | null;
  apellido2: string | null;
  nombreCompleto: string;
  cedula: string | null;
  fechaNacimiento: string | null;
  edad: number | null;
  sexo: string | null;
  nacionalidad: string | null;
  nivelEducativo: string | null;
  puesto: string | null;
  departamento: string | null;
  fechaIngreso: string | null;
  salario: number;
  estatus: string;
}
export interface GeneralPayslip {
  empleado: string | null;
  codigo: string | null;
  cedula: string | null;
  puesto: string | null;
  fechaPago: string | null;
  periodo: number | null;
  mes: number | null;
  ano: number | null;
  nomina: number | null;
  ingresos: Record<string, number>;
  deducciones: Record<string, number>;
  totalDevengado: number;
  totalDeducciones: number;
  neto: number;
}
export interface GeneralPayslipsResponse {
  count: number;
  conceptos: { ingresos: string[]; deducciones: string[] };
  totals: { devengado: number; deducciones: number; neto: number };
  items: GeneralPayslip[];
}
export interface GeneralPayrollPeriod {
  ano: number; mes: number; periodo: number;
  fecha: string | null; pagoOid: number; descripcion: string;
}
export interface GeneralEmployeePayment {
  pagoOid: number; fecha: string | null; periodo: number | null; mes: number | null;
  ano: number | null; nomina: number | null; descripcion: string;
  totalDevengado: number; totalDeducciones: number; neto: number; conceptos: number;
}
export interface GeneralPaymentLine {
  concepto: string | null; tipo: number; valor: number; calculado: number;
  monto: number; comentario: string | null;
}
export interface GeneralPaymentDetail {
  empleado: string | null; codigo: string | null; cedula: string | null; puesto: string | null;
  fecha: string | null; periodo: number | null; mes: number | null; ano: number | null; nomina: number | null;
  lineas: GeneralPaymentLine[]; totalDevengado: number; totalDeducciones: number; neto: number;
}
export interface GeneralPaymentCompare {
  items: Array<{
    concepto: string; tipo: number; actual: number; anterior: number;
    diferencia: number; variacion: number | null; anomalia: boolean;
  }>;
  totales: { actual: number; anterior: number };
  anomalias: number;
}

export interface GeneralPayrollAnomalyItem {
  codigo: string;
  empleado: string;
  cedula: string;
  concepto: string;
  tipo: "Ingreso" | "Deducción";
  anomalia: string;
  severidad: "alta" | "media" | "baja";
  actual: number;
  anterior: number;
  diferencia: number;
  variacion: number | null;
  pagos?: number;
  lineas?: number;
  nota: string;
}

export interface GeneralPayrollAnomalies {
  actual?: { ano: number; mes: number; periodo: number; fecha: string | null };
  anterior?: { ano: number; mes: number; periodo: number; fecha: string | null };
  periodos: Array<{ ano: number; mes: number; periodo: number; fecha: string | null }>;
  resumen: {
    total?: number;
    empleados?: number;
    duplicidades?: number;
    deduccionesNuevas?: number;
    deduccionesEliminadas?: number;
    aumentosDeduccion?: number;
    ingresosNuevos?: number;
    reclasificaciones?: number;
    impactoDeducciones?: number;
  };
  items: GeneralPayrollAnomalyItem[];
}
export const generalSqlApi = {

  status: () => apiFetch<GeneralSqlStatus>("/general-sql/status"),
  tables: () => apiFetch<Array<{ schema: string; name: string }>>("/general-sql/tables"),
  columns: (table: string) =>
    apiFetch<Array<{ name: string; type: string; nullable: string }>>(`/general-sql/columns/${encodeURIComponent(table)}`),
  periods: () => apiFetch<GeneralPeriod[]>("/general-sql/periods"),
  payroll: (pagoOID: string | number) =>
    apiFetch<{ count: number; totals: any; items: any[] }>(`/general-sql/payroll/${encodeURIComponent(String(pagoOID))}`),
  overtime: (desde: string, hasta: string) =>
    apiFetch<any[]>(`/general-sql/overtime?desde=${desde}&hasta=${hasta}`),
  holidays: (ano: number) => apiFetch<any[]>(`/general-sql/holidays?ano=${ano}`),
  employees: (incluirInactivos = true) =>
    apiFetch<GeneralEmployee[]>(`/general-sql/employees?inactivos=${incluirInactivos}`),
  loans: () => apiFetch<{ count: number; totals: { prestado: number; cobrado: number; saldo: number }; items: GeneralLoan[] }>("/general-sql/loans"),
  weapons: () => apiFetch<GeneralWeapon[]>("/general-sql/weapons"),
  /** URL directa de una foto (licencia/arma) guardada en gSafeOne. */
  weaponImageUrl: (
    oid: number | string,
    kind: "licenciaFrente" | "licenciaDorso" | "arma1" | "arma2" | "arma3" | "arma4",
  ) => {
    if (!BASE_URL) return "";
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("safeone_token") : null;
    return `${BASE_URL}/general-sql/weapons/${encodeURIComponent(String(oid))}/image/${kind}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },
  analyze: (body: { current: string | number; previous?: string | number; excelRows?: any[] }) =>
    apiFetch<PayrollAnalysis>("/general-sql/analyze", { method: "POST", body: JSON.stringify(body) }),
  employeeHistory: (empleadoOID: string | number) =>
    apiFetch<PayrollHistoryEntry[]>(`/general-sql/employee-history/${encodeURIComponent(String(empleadoOID))}`),
  peek: (table: string) => apiFetch<any[]>(`/general-sql/peek/${encodeURIComponent(table)}`),
  expedienteStatus: () => apiFetch<{ fecha: string | null }>("/general-sql/expediente/status"),
  expedienteDates: () => apiFetch<string[]>("/general-sql/expediente/dates"),
  expediente: (fecha?: string) =>
    apiFetch<GeneralExpediente>(`/general-sql/expediente${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ""}`),
  /** Expediente CONTRACTUAL: Cliente → Localidad → Puesto de servicio → Horario → Detalle. */
  contrato: (todos = false) =>
    apiFetch<GeneralContrato>(`/general-sql/contrato${todos ? "?todos=1" : ""}`),
  schemaKeys: () => apiFetch<Array<{ tabla: string; tipo: string; columna: string; restriccion: string }>>("/general-sql/schema-keys"),
  clients: () => apiFetch<GeneralClient[]>("/general-sql/clients"),
  employeesActive: () =>
    apiFetch<{ count: number; items: GeneralActiveEmployee[] }>("/general-sql/employees-active"),
  payslips: (p?: { ano: number; mes: number; periodo: number }) =>
    apiFetch<GeneralPayslipsResponse>(
      `/general-sql/payslips${p ? `?ano=${p.ano}&mes=${p.mes}&periodo=${p.periodo}` : ""}`
    ),
  payrollPeriods: () => apiFetch<GeneralPayrollPeriod[]>("/general-sql/payroll-periods"),
  employeePayments: (codigo: string) =>
    apiFetch<GeneralEmployeePayment[]>(`/general-sql/employee-payments?codigo=${encodeURIComponent(codigo)}`),
  paymentDetail: (codigo: string, pagoOid: number) =>
    apiFetch<GeneralPaymentDetail>(`/general-sql/payment-detail?codigo=${encodeURIComponent(codigo)}&pagoOid=${pagoOid}`),
  paymentCompare: (codigo: string, pago1: number, pago2: number) =>
    apiFetch<GeneralPaymentCompare>(`/general-sql/payment-compare?codigo=${encodeURIComponent(codigo)}&pago1=${pago1}&pago2=${pago2}`),
  /** Anomalías de toda la nómina: quincena seleccionada vs quincena anterior. */
  payrollAnomalies: (p?: { ano: number; mes: number; periodo: number }) =>
    apiFetch<GeneralPayrollAnomalies>(
      `/general-sql/payroll-anomalies${p ? `?ano=${p.ano}&mes=${p.mes}&periodo=${p.periodo}` : ""}`
    ),

  clientServices: (oid: number | string) =>
    apiFetch<GeneralClientService[]>(`/general-sql/clients/${encodeURIComponent(String(oid))}/servicios`),
  clientContacts: (oid: number | string) =>
    apiFetch<GeneralClientContact[]>(`/general-sql/clients/${encodeURIComponent(String(oid))}/contactos`),
};

// ─── Registro Mercantil (capa JSON local sobre clientes de gSafeOne) ───
export interface GeneralClientService {
  oid: number;
  articulo: number | null;
  descripcion: string | null;
  cantidad: number | null;
  precio: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}
export interface GeneralClientContact {
  oid: number;
  tipo: string;
  valor: string;
}
export interface MercantileRecord {
  registroMercantil: string;
  camaraComercio: string;
  emision: string;
  vence: string;
  nota?: string;
  activo?: boolean;
  /** Expediente de Asociado de Negocio (formularios F-ADM, documentos, OFAC, etc.) */
  expediente?: any;
  updatedAt?: string;
  updatedBy?: string | null;
}

export type MercantileStore = Record<string, MercantileRecord>;

export const mercantileRegistryApi = {
  all: () => apiFetch<MercantileStore>("/mercantile-registry"),
  save: (clienteId: string | number, body: Partial<MercantileRecord>) =>
    apiFetch<MercantileRecord>(`/mercantile-registry/${encodeURIComponent(String(clienteId))}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deactivate: (clienteId: string | number, reason: string) =>
    apiFetch<MercantileRecord>(`/mercantile-registry/${encodeURIComponent(String(clienteId))}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),
  bulk: (items: Array<Partial<MercantileRecord> & { clienteId: string }>, validClientIds: string[]) =>
    apiFetch<{ total: number; exitos: number; errores: number; detalle: Array<{ fila: number; clienteId: string; ok: boolean; error?: string }>; store: MercantileStore }>(
      "/mercantile-registry/bulk",
      { method: "POST", body: JSON.stringify({ items, validClientIds }) }
    ),
};

// ─── Documentos digitales por cliente (Servicio al Cliente) ───
export interface ClientDocument {
  id: string;
  docKey: string;
  docNombre: string;
  fileName: string;
  storedName: string;
  url: string;
  mime?: string;
  size: number;
  nota?: string;
  activo: boolean;
  uploadedAt: string;
  uploadedBy?: string | null;
}

export const clientDocumentsApi = {
  list: (clienteId: string | number) =>
    apiFetch<ClientDocument[]>(`/client-documents/${encodeURIComponent(String(clienteId))}`),
  upload: (
    clienteId: string | number,
    body: { docKey: string; docNombre: string; fileName: string; dataUrl: string; mime?: string; nota?: string },
  ) =>
    apiFetch<ClientDocument>(`/client-documents/${encodeURIComponent(String(clienteId))}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (clienteId: string | number, docId: string, reason: string) =>
    apiFetch<ClientDocument>(`/client-documents/${encodeURIComponent(String(clienteId))}/${docId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),
};


// ─── Activo Fijo — base [SafeOne] (SQL Server, solo lectura) ───
export interface SafeOneActivoFijoRow {
  OID: number;
  Descripcion: string | null;
  Serial: string | null;
  Modelo: string | null;
  CodigoBarra: string | null;
  Ubicacion: string | null;
  Departamento: string | null;
  Encargado: string | null;
  Comentario?: string | null;
  Documento?: string | null;
  FechaAdq: string | null;
  FechaInicio?: string | null;
  FechaRet?: string | null;
  CostoAdq: number | null;
  Depreciacion?: number | null;
  DepreciacionInicial?: number | null;
  DeprAnoAnt?: number | null;
  DeprAnoAct?: number | null;
  Categoria: number | null;
  Tipo: number | null;
  Suplidor?: number | null;
  Transito?: boolean | null;
  Retirado?: boolean | null;
}

export interface FixedAssetsCompareResponse {
  stats: {
    sqlTotal: number;
    intranetTotal: number;
    matched: number;
    onlyInSql: number;
    onlyInIntranet: number;
  };
  matched: Array<{ sql: SafeOneActivoFijoRow; intranet: any }>;
  onlyInSql: SafeOneActivoFijoRow[];
  onlyInIntranet: any[];
}

export interface FixedAssetsBackupMeta {
  id: string;
  createdAt: string;
  createdBy: string;
  note?: string;
  count: number;
  totalCosto: number;
}

export interface FixedAssetsAnalytics {
  generatedAt: string;
  resumen: Record<string, any> | null;
  calidad: Record<string, any> | null;
  suplidores: any[];
  categorias: any[];
  departamentos: any[];
  antiguedad: any[];
  sinSerial: any[];
  serialesDuplicados: any[];
  sinEncargado: any[];
  movimientos: any[];
  depreciacion: any[];
  errors: Record<string, string>;
}

export interface AssetLookupResult {
  code: string;
  asset: {
    OID: number;
    Descripcion?: string | null;
    Serial?: string | null;
    Modelo?: string | null;
    CodigoBarra?: string | null;
    Ubicacion?: string | null;
    Departamento?: string | null;
    Encargado?: string | null;
    Comentario?: string | null;
    FechaAdq?: string | null;
    FechaInicio?: string | null;
    FechaRet?: string | null;
    CostoAdq?: number | null;
    Transito?: number | null;
    Retirado?: number | null;
    CategoriaNombre?: string | null;
    TipoNombre?: string | null;
    SuplidorNombre?: string | null;
  };
}

export const fixedAssetsSqlApi = {
  lookup: (code: string) => apiFetch<AssetLookupResult>(`/fixed-assets-sql/lookup/${encodeURIComponent(code)}`),
  status: () => apiFetch<{ configured: boolean; connected: boolean; message: string; host: string | null; database: string | null }>("/fixed-assets-sql/status"),

  list: (includeRetired = false) =>
    apiFetch<{ count: number; rows: SafeOneActivoFijoRow[] }>(`/fixed-assets-sql/activo-fijo?includeRetired=${includeRetired}`),
  compare: (intranet: any[]) =>
    apiFetch<FixedAssetsCompareResponse>("/fixed-assets-sql/compare", { method: "POST", body: JSON.stringify({ intranet }) }),
  analytics: () => apiFetch<FixedAssetsAnalytics>("/fixed-assets-sql/analytics"),
  schema: () => apiFetch<{ tables: { Tabla: string; Columnas: number }[] }>("/fixed-assets-sql/schema"),
  listBackups: () => apiFetch<FixedAssetsBackupMeta[]>("/fixed-assets-sql/backups"),
  createBackup: (assets: any[], note?: string) =>
    apiFetch<FixedAssetsBackupMeta>("/fixed-assets-sql/backups", { method: "POST", body: JSON.stringify({ assets, note }) }),
  getBackup: (id: string) => apiFetch<FixedAssetsBackupMeta & { assets: any[] }>(`/fixed-assets-sql/backups/${id}`),
  deleteBackup: (id: string) => apiFetch<void>(`/fixed-assets-sql/backups/${id}`, { method: "DELETE" }),
  updateActivoFijo: (oid: number, changes: Partial<Record<SafeOneEditableField, string | null>>) =>
    apiFetch<{ updated: number; row: SafeOneActivoFijoRow; changes?: Record<string, { from: any; to: any }>; message?: string }>(
      `/fixed-assets-sql/activo-fijo/${oid}`,
      { method: "PUT", body: JSON.stringify(changes) }
    ),
  detalle: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
    return apiFetch<{ count: number; total: number; rows: any[] }>(`/fixed-assets-sql/detalle?${qs.toString()}`);
  },
  audit: (oid?: number) =>
    apiFetch<SafeOneAssetAuditEntry[]>(`/fixed-assets-sql/audit${oid ? `?oid=${oid}` : ""}`),
};

export type SafeOneEditableField =
  | "Descripcion" | "Serial" | "Modelo" | "CodigoBarra"
  | "Ubicacion" | "Departamento" | "Encargado" | "Comentario" | "Documento";

export const SAFEONE_EDITABLE_FIELDS: { key: SafeOneEditableField; label: string }[] = [
  { key: "Descripcion", label: "Descripción" },
  { key: "Serial", label: "Serial" },
  { key: "Modelo", label: "Modelo" },
  { key: "CodigoBarra", label: "Código de barra" },
  { key: "Ubicacion", label: "Ubicación" },
  { key: "Departamento", label: "Departamento" },
  { key: "Encargado", label: "Encargado" },
  { key: "Documento", label: "Documento" },
  { key: "Comentario", label: "Comentario" },
];

export interface SafeOneAssetAuditEntry {
  id: string;
  oid: number;
  at: string;
  by: string;
  email?: string | null;
  descripcion?: string | null;
  changes: Record<string, { from: any; to: any }>;
}




// Cliente leído desde gSafeOne (tabla Cliente + ClienteServicio.Descripcion)
export interface GeneralClient {
  oid: number;
  codigo: number | null;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  rnc?: string | null;
  cedula?: string | null;
  contacto?: string | null;
  inactivo?: boolean;
  servicio?: string | null;
}


// ─── Expediente Overlay (capa editable local sobre GENERAL) ───
export interface ExpedienteOverlayEntry {
  estatus?: string | null;
  nota?: string | null;
  noLicencia?: string | null;
  custodioOverride?: string | null;
  /** Marca manual: el arma está resguardada en la bóveda de Sede Central. */
  enBoveda?: boolean;
  // Sobrescrituras del catálogo de armas (auditoría: alinear lo mostrado).
  marca?: string | null;
  propietario?: string | null;
  calibre?: string | null;
  categoria?: string | null;
  tipo?: string | null;
  fotosArma?: string[];
  fotoLicenciaFrente?: string | null;
  fotoLicenciaDorso?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}
export type ExpedienteOverlayMap = Record<string, ExpedienteOverlayEntry>;

export interface ExpedienteMovement {
  id: string;
  tipo: "arma" | "personal";
  serie?: string | null;
  armaModelo?: string | null;
  empleado?: string | number | null;
  empleadoNombre?: string | null;
  desde?: string | null;
  hacia?: string | null;
  motivo?: string;
  fecha?: string;
  registradoPor?: string;
}

export const expedienteOverlayApi = {
  canEdit: () => apiFetch<{ canEdit: boolean }>("/expediente-overlay/can-edit"),
  list: () => apiFetch<ExpedienteOverlayMap>("/expediente-overlay"),
  get: (serie: string) => apiFetch<ExpedienteOverlayEntry>(`/expediente-overlay/${encodeURIComponent(serie)}`),
  save: (serie: string, data: Partial<ExpedienteOverlayEntry>) =>
    apiFetch<ExpedienteOverlayEntry>(`/expediente-overlay/${encodeURIComponent(serie)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  uploadPhoto: (serie: string, dataUrl: string, fileName: string, kind: "arma" | "licenciaFrente" | "licenciaDorso") =>
    apiFetch<{ url: string; overlay: ExpedienteOverlayEntry }>(`/expediente-overlay/${encodeURIComponent(serie)}/photo`, {
      method: "POST",
      body: JSON.stringify({ dataUrl, fileName, kind }),
    }),
  deletePhoto: (serie: string, url: string, kind: "arma" | "licenciaFrente" | "licenciaDorso") =>
    apiFetch<ExpedienteOverlayEntry>(`/expediente-overlay/${encodeURIComponent(serie)}/photo`, {
      method: "DELETE",
      body: JSON.stringify({ url, kind }),
    }),
  movements: (params?: { serie?: string; empleado?: string | number; tipo?: string }) => {
    const q = new URLSearchParams();
    if (params?.serie) q.set("serie", params.serie);
    if (params?.empleado != null) q.set("empleado", String(params.empleado));
    if (params?.tipo) q.set("tipo", params.tipo);
    const qs = q.toString();
    return apiFetch<ExpedienteMovement[]>(`/expediente-overlay/movements/all${qs ? `?${qs}` : ""}`);
  },
  addMovement: (data: Partial<ExpedienteMovement>) =>
    apiFetch<ExpedienteMovement>("/expediente-overlay/movements", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // Líneas ocultas (eliminar registros duplicados/erróneos del expediente).
  hidden: () => apiFetch<string[]>("/expediente-overlay/hidden/all"),
  hide: (key: string) =>
    apiFetch<string[]>("/expediente-overlay/hidden", { method: "POST", body: JSON.stringify({ key }) }),
  unhide: (key: string) =>
    apiFetch<string[]>("/expediente-overlay/hidden", { method: "DELETE", body: JSON.stringify({ key }) }),
  // Plantilla de horario semanal por puesto (Lun–Dom + Feriado).
  schedules: () => apiFetch<Record<string, PostScheduleEntry>>("/expediente-overlay/schedule/all"),
  getSchedule: (postKey: string) =>
    apiFetch<PostScheduleEntry | null>(`/expediente-overlay/schedule/${encodeURIComponent(postKey)}`),
  saveSchedule: (postKey: string, data: Partial<PostScheduleEntry>) =>
    apiFetch<PostScheduleEntry>(`/expediente-overlay/schedule/${encodeURIComponent(postKey)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Plantilla de horario semanal por puesto ───
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo" | "feriado";

export interface PostScheduleSlot {
  tanda: string;          // turno/tanda esperada
  vigilante?: string;     // vigilante esperado (opcional)
  arma?: string;          // serial/arma esperada (opcional)
}

export interface PostScheduleEntry {
  cliente?: string | null;
  puesto?: string | null;
  requiereArma?: boolean;
  semana: Record<DiaSemana, PostScheduleSlot[]>;
  updatedAt?: string;
  updatedBy?: string;
}

// ─── Feriados de República Dominicana ───
export interface Holiday {
  date: string;       // YYYY-MM-DD
  name: string;
  localName?: string;
  origen?: "oficial" | "manual";
}
export interface HolidaysResponse {
  year: number;
  source: "nager" | "cache" | null;
  items: Holiday[];
}
export const holidaysApi = {
  list: (year: number) => apiFetch<HolidaysResponse>(`/holidays?year=${year}`),
  refresh: (year: number) =>
    apiFetch<HolidaysResponse>("/holidays/refresh", { method: "POST", body: JSON.stringify({ year }) }),
  addManual: (date: string, name: string) =>
    apiFetch<{ items: Holiday[] }>("/holidays/manual", { method: "POST", body: JSON.stringify({ date, name }) }),
  remove: (date: string) =>
    apiFetch<{ items: Holiday[] }>("/holidays/manual", { method: "DELETE", body: JSON.stringify({ date }) }),
};

export interface GeneralWeaponDetail {
  oid: number | null;
  serie: string | null;
  marca: string | null;
  tipo: string | null;
  calibre: string | null;
  categoria: string | null;
  noLicencia: string | null;
  estatus: string | null;
  propietario: string | null;
  capsulas?: number | null;
  vence?: string | null;
  permanente?: boolean;
  /** Fotos de licencia/arma almacenadas en gSafeOne (se sirven bajo demanda) */
  fotoLicenciaFrenteDb?: boolean;
  fotoLicenciaDorsoDb?: boolean;
  fotosArmaDb?: string[];
}

export interface GeneralExpedientePuesto {
  lineaOID: number;
  puesto: string;
  localidad?: string;
  tanda?: string;
  puestoCodigo: number | null;
  vigilante: string;
  vigilanteOID: number | null;
  vigilanteCodigo: number | null;
  vigilanteCedula: string | null;
  vigilanteFechaNacimiento?: string | null;
  vigilanteEdad?: number | null;
  horas: number;
  incentivo: number;
  requiereArma: boolean;
  armaOID: number | null;
  armaSerial: string | null;
  armaModelo: string | null;
  arma: GeneralWeaponDetail | null;
  novedad: boolean;
  comentario: string;
  origen?: "general" | "operaciones";
  armaOrigen?: "general" | "operaciones";
}

export interface GeneralExpedienteCliente {
  oid: number;
  codigo: number | null;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  rnc: string;
  cedula: string;
  contacto: string;
  inactivo: boolean;
  puestos: GeneralExpedientePuesto[];
  origen?: "general" | "operaciones";
}

export interface GeneralExpediente {
  fecha: string | null;
  clientes: GeneralExpedienteCliente[];
  totals: {
    clientes?: number;
    puestosCubiertos?: number;
    vigilantes?: number;
    armas?: number;
    sinArma?: number;
    conNovedad?: number;
  };
}

export interface GeneralEmployee {
  oid: number | string; codigo?: string; nombre: string; cedula?: string;
  salario: number; tarifa: number; fechaIngreso?: string;
  puestoOID?: any; deptOID?: any; activo: boolean;
}
export interface GeneralLoan {
  oid: number | string; codigo?: string; empleado: string; fecha?: string;
  monto: number; cuota: number; pagado: number; saldo: number;
  meses: number; interes: number; tasaInteres: number;
}
export interface GeneralWeapon {
  oid: number | string; codigo?: string | null; serie?: string | null; modelo?: string | null;
  registro?: string | null; marca?: string | null; calibre?: string | null;
  tipo?: string | null; categoria?: string | null; noLicencia?: string | null;
  estatus?: string | null; propietario?: string | null;
  /** OID de EstatusArma (9 Regular, 12 EN REPARACION, 14 En Boveda). */
  estatusOid?: number | null;
  /** true cuando el estatus en gSafeOne es 14 (En Boveda). */
  enBovedaDb?: boolean;
}

// ─── Operaciones: Expediente Digital (clientes, localidades, puestos, reporte diario, bóveda) ───
function crudApi<T extends { id: string }>(path: string) {
  return {
    list: () => apiFetch<T[]>(`/${path}`),
    create: (data: Partial<T>) => apiFetch<T>(`/${path}`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<T>) => apiFetch<T>(`/${path}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => apiFetch<void>(`/${path}/${id}`, { method: "DELETE" }),
  };
}

export const opsClientsApi = crudApi<{ id: string }>("ops-clients");
export const opsLocationsApi = crudApi<{ id: string }>("ops-locations");
export const opsPostsApi = crudApi<{ id: string }>("ops-posts");
export const opsDailyReportsApi = crudApi<{ id: string }>("ops-daily-reports");
export const vaultMovementsApi = crudApi<{ id: string }>("vault-movements");

// ─── Provisionamiento de Vacaciones ───
export interface VacationDept {
  id: string; name: string; available: boolean;
  count?: number; leaderCode?: string | null; leaderName?: string | null;
  pendingCount?: number; approvedCount?: number;
}
export interface VacationPolicy { under5Days: number; from5Days: number; tenureThresholdYears: number; }
export interface VacationPeriod { start: string; end: string; days: number; }
export type VacationStatus = "pendiente" | "pendiente-gerencia" | "aprobada" | "rechazada";
export interface VacationHistory { at: string; by: string; action: string; detail: string; }
export interface VacationRequest {
  id: string; codigo: string; nombre: string; department: string;
  periods: VacationPeriod[]; notes?: string; status: VacationStatus;
  needsManagement?: boolean; managementApproved?: boolean;
  requestedBy: string; requestedByName: string; requestedAt: string;
  approverName?: string; decidedAt?: string; decisionNotes?: string;
  updatedAt?: string; history?: VacationHistory[];
}
export interface VacationServiceTime { years: number; months: number; days: number; }
export interface VacationEmployee {
  codigo: string; nombre: string; position: string; cumpleanos: string;
  isLeader: boolean;
  fechaIngreso: string | null;
  antiguedadAnios: number | null; tiempoServicio?: VacationServiceTime | null;
  diasDerecho: number; diasEstimados: boolean;
  elegibleDesde?: string | null;
  hitos?: { seisMeses: string | null; unAnio: string | null; cincoAnios: string | null } | null;
  diasAprobados: number; diasPendientes: number;

  workDays?: number[];          // 0=Dom..6=Sáb — días que cuentan como laborables
  workDaysCustom?: boolean;     // true si fue configurado manualmente
  requests: VacationRequest[];
}
export interface VacationRoster {
  department: string; name?: string; available: boolean; sqlConnected?: boolean;
  leaderCode?: string | null; leaderName?: string | null;
  employees: VacationEmployee[];
}
export interface OnVacationEntry { codigo: string; nombre: string; department: string; periods: VacationPeriod[]; requestId: string; }
export interface OnVacationResult { from: string; to: string; employees: OnVacationEntry[]; }
export const vacationsApi = {
  departments: () => apiFetch<VacationDept[]>("/vacations/departments"),
  policy: () => apiFetch<VacationPolicy>("/vacations/policy"),
  savePolicy: (body: VacationPolicy) =>
    apiFetch<VacationPolicy>("/vacations/policy", { method: "PUT", body: JSON.stringify(body) }),
  roster: (deptId: string) => apiFetch<VacationRoster>(`/vacations/roster/${encodeURIComponent(deptId)}`),
  saveEmployeeConfig: (codigo: string, body: { workDays: number[]; actorName?: string }) =>
    apiFetch<{ workDays: number[]; updatedAt: string; updatedBy: string }>(
      `/vacations/employee-config/${encodeURIComponent(codigo)}`,
      { method: "PUT", body: JSON.stringify(body) },
    ),
  requests: (params?: { status?: string; codigo?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<VacationRequest[]>(`/vacations/requests${q ? `?${q}` : ""}`);
  },
  onVacation: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return apiFetch<OnVacationResult>(`/vacations/on-vacation${s ? `?${s}` : ""}`);
  },
  createRequest: (body: {
    codigo: string; nombre: string; department: string;
    periods: VacationPeriod[]; notes?: string; requestedByName?: string;
  }) => apiFetch<VacationRequest>("/vacations/requests", { method: "POST", body: JSON.stringify(body) }),
  updateRequest: (id: string, body: { periods?: VacationPeriod[]; notes?: string; actorName?: string }) =>
    apiFetch<VacationRequest>(`/vacations/requests/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  decide: (id: string, body: { decision: VacationStatus; approverName?: string; decisionNotes?: string }) =>
    apiFetch<VacationRequest>(`/vacations/requests/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify(body) }),
  deleteRequest: (id: string) =>
    apiFetch<{ success: boolean }>(`/vacations/requests/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ─── Recepción / Visitantes ───
export type VisitorCategory =
  | "cliente_corporativo"
  | "cliente_residencial"
  | "solicitante_empleo"
  | "familiar_amigo"
  | "ex_empleado"
  | "proveedor"
  | "otro";

export interface Visitor {
  id: string;
  cedula: string;
  fullName: string;
  category: VisitorCategory;
  host?: string;
  purpose?: string;
  notes?: string;
  photoUrl?: string;
  checkInAt: string;
  checkOutAt: string | null;
  createdBy?: string;
  updatedAt?: string;
}

export interface VisitorStats {
  total: number;
  currentlyIn: number;
  byCategory: Record<VisitorCategory, number>;
  byDay: Record<string, number>;
  categories: VisitorCategory[];
}

export const visitorsApi = {
  list: (params?: { from?: string; to?: string; status?: "in" | "out" | "all"; category?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch<Visitor[]>(`/visitors${q ? `?${q}` : ""}`);
  },
  create: (body: Partial<Visitor>) =>
    apiFetch<Visitor>("/visitors", { method: "POST", body: JSON.stringify(body) }),
  checkout: (id: string) =>
    apiFetch<Visitor>(`/visitors/${encodeURIComponent(id)}/checkout`, { method: "POST" }),
  update: (id: string, body: Partial<Visitor>) =>
    apiFetch<Visitor>(`/visitors/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/visitors/${encodeURIComponent(id)}`, { method: "DELETE" }),
  stats: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return apiFetch<VisitorStats>(`/visitors/stats/summary${s ? `?${s}` : ""}`);
  },
};

export default apiFetch;






// ─── Expediente contractual (Cliente → Localidad → Puesto → Horario → Detalle) ───
export interface GeneralContratoDetalle {
  oid: number | null;
  horas: number;
  tanda: string | null;
  vigilanteOID: number | null;
  vigilante: string | null;
  vigilanteCodigo: number | null;
  vigilanteCedula: string | null;
  incentivo: number;
  precio: number;
  horaDesde: string | null;
  horaHasta: string | null;
}

export interface GeneralContratoHorario {
  oid: number | null;
  dia: string | null;
  regularHoras: number;
  tandas: number;
  detalles: GeneralContratoDetalle[];
}

export interface GeneralContratoPuesto {
  oid: number | null;
  referencia: string;
  armaOID: number | null;
  requiereArma: boolean;
  armaSerial: string | null;
  arma: GeneralWeaponDetail | null;
  horarios: GeneralContratoHorario[];
}

export interface GeneralContratoLocalidad {
  oid: number | null;
  nombre: string;
  zona: string | null;
  subZona: string | null;
  geo: string | null;
  puestos: GeneralContratoPuesto[];
}

export interface GeneralContratoCliente {
  oid: number;
  codigo: number | null;
  nombre: string;
  rnc: string;
  cedula: string;
  direccion: string;
  telefono: string;
  email: string;
  contacto: string;
  inactivo: boolean;
  localidades: GeneralContratoLocalidad[];
}

export interface GeneralContrato {
  fuente: "contrato" | "hora-contratada";
  disponible: { localidades: boolean; puestos: boolean; horarios: boolean; detalles: boolean };
  clientes: GeneralContratoCliente[];
  totals: {
    clientes: number; localidades: number; puestos: number; horarios: number;
    lineas: number; armas: number; vigilantes: number; horasSemana: number; precio: number;
  };
}
