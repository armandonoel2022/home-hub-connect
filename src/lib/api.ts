/**
 * API Service Layer for SafeOne Intranet
 * 
 * This file centralizes all API calls. Currently uses mock data.
 * Tomorrow, replace the BASE_URL and remove mock fallbacks to connect to SQL Server.
 * 
 * SQL Server connection will be via a REST API (Node.js/Express or .NET) 
 * running on your server alongside IIS or as a Windows Service.
 * 
 * Example .env config:
 *   VITE_API_URL=http://192.168.1.X:3000/api
 * 
 * Your API should expose endpoints like:
 *   GET    /api/tickets
 *   POST   /api/tickets
 *   PUT    /api/tickets/:id
 *   GET    /api/equipment
 *   POST   /api/equipment
 *   GET    /api/vehicles
 *   GET    /api/phones
 *   GET    /api/personnel
 *   GET    /api/users
 *   POST   /api/auth/login
 *   GET    /api/birthdays/today
 */

const BASE_URL = import.meta.env.VITE_API_URL || "";

// Helper for fetch calls — will be used once SQL Server API is ready
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new Error("API not configured. Set VITE_API_URL in .env");
  }

  const token = localStorage.getItem("safeone_token");

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("safeone_token");
    localStorage.removeItem("safeone_user");
    window.location.href = "/login";
    throw new Error("No autorizado");
  }

  if (res.status === 403) {
    throw new Error("No tienes acceso a este recurso");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Error del servidor" }));
    throw new Error(err.message || `Error ${res.status}`);
  }

  return res.json();
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => {
    localStorage.removeItem("safeone_token");
    localStorage.removeItem("safeone_user");
  },
};

// Tickets
export const ticketsApi = {
  getAll: () => apiFetch<any[]>("/tickets"),
  create: (ticket: any) =>
    apiFetch<any>("/tickets", { method: "POST", body: JSON.stringify(ticket) }),
  update: (id: string, data: any) =>
    apiFetch<any>(`/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// Equipment
export const equipmentApi = {
  getAll: () => apiFetch<any[]>("/equipment"),
  create: (eq: any) =>
    apiFetch<any>("/equipment", { method: "POST", body: JSON.stringify(eq) }),
};

// Vehicles
export const vehiclesApi = {
  getAll: () => apiFetch<any[]>("/vehicles"),
  create: (v: any) =>
    apiFetch<any>("/vehicles", { method: "POST", body: JSON.stringify(v) }),
};

// Phone Fleet
export const phonesApi = {
  getAll: () => apiFetch<any[]>("/phones"),
  create: (p: any) =>
    apiFetch<any>("/phones", { method: "POST", body: JSON.stringify(p) }),
};

// Armed Personnel
export const personnelApi = {
  getAll: () => apiFetch<any[]>("/personnel"),
  create: (p: any) =>
    apiFetch<any>("/personnel", { method: "POST", body: JSON.stringify(p) }),
};

// Users & Birthdays
export const usersApi = {
  getAll: () => apiFetch<any[]>("/users"),
  getBirthdaysToday: () => apiFetch<any[]>("/birthdays/today"),
};

export default apiFetch;
