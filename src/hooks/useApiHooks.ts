/**
 * React Query hooks for all intranet modules.
 * 
 * Dual-mode: When VITE_API_URL is set, fetches from the SQL Server API.
 * Otherwise, uses mock data for local development.
 * 
 * Usage in pages:
 *   const { data: tickets, isLoading, create, update, remove } = useTickets();
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  isApiConfigured,
  ticketsApi,
  equipmentApi,
  vehiclesApi,
  phonesApi,
  personnelApi,
  notificationsApi,
  purchaseRequestsApi,
  hiringRequestsApi,
  minorPurchasesApi,
  tasksApi,
} from "@/lib/api";
import {
  mockTickets,
  mockEquipment,
  mockVehicles,
  mockPhones,
  mockArmedPersonnel,
} from "@/lib/mockData";
import type {
  Ticket,
  Equipment,
  Vehicle,
  PhoneDevice,
  ArmedPersonnel,
  PurchaseRequest,
  HiringRequest,
  MinorPurchase,
} from "@/lib/types";
import type { AppNotification } from "@/lib/types";
import { useState, useCallback, useEffect } from "react";

// ─── Helper: localStorage state manager for mock mode ───
const SEED_VERSION = "v3"; // Bump this to force re-seed of mock data

function useLocalState<T>(key: string, initial: T[]) {
  const [data, setData] = useState<T[]>(() => {
    if (isApiConfigured()) return initial;
    try {
      const versionKey = `${key}_version`;
      const storedVersion = localStorage.getItem(versionKey);
      if (storedVersion === SEED_VERSION) {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : initial;
      }
      // Version mismatch or first load: use seed data
      localStorage.setItem(key, JSON.stringify(initial));
      localStorage.setItem(versionKey, SEED_VERSION);
      return initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!isApiConfigured()) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  }, [data, key]);

  return [data, setData] as const;
}

// ═══════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════
export function useTickets() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<Ticket>("safeone_tickets", mockTickets);

  const query = useQuery({
    queryKey: ["tickets"],
    queryFn: () => (apiMode ? ticketsApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (ticket: Omit<Ticket, "id"> & { id?: string }) => {
      if (apiMode) return ticketsApi.create(ticket);
      const newTicket = { ...ticket, id: ticket.id || `TK-${Date.now().toString().slice(-6)}` } as Ticket;
      setLocalData((prev) => [newTicket, ...prev]);
      return Promise.resolve(newTicket);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Ticket> }) => {
      if (apiMode) return ticketsApi.update(id, data);
      setLocalData((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
      return Promise.resolve({} as Ticket);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return ticketsApi.delete(id);
      setLocalData((prev) => prev.filter((t) => t.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<Ticket>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    setData: setLocalData,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

// ═══════════════════════════════════════════
// EQUIPMENT
// ═══════════════════════════════════════════
export function useEquipment() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<Equipment>("safeone_equipment", mockEquipment);

  const query = useQuery({
    queryKey: ["equipment"],
    queryFn: () => (apiMode ? equipmentApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (eq: Omit<Equipment, "id"> & { id?: string }) => {
      if (apiMode) return equipmentApi.create(eq);
      const newEq = { ...eq, id: eq.id || `EQ-${Date.now().toString().slice(-6)}` } as Equipment;
      setLocalData((prev) => [newEq, ...prev]);
      return Promise.resolve(newEq);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Equipment> }) => {
      if (apiMode) return equipmentApi.update(id, data);
      setLocalData((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
      return Promise.resolve({} as Equipment);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return equipmentApi.delete(id);
      setLocalData((prev) => prev.filter((e) => e.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<Equipment>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    setData: setLocalData,
  };
}

// ═══════════════════════════════════════════
// VEHICLES
// ═══════════════════════════════════════════
export function useVehicles() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<Vehicle>("safeone_vehicles", mockVehicles);

  const query = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => (apiMode ? vehiclesApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (v: Omit<Vehicle, "id"> & { id?: string }) => {
      if (apiMode) return vehiclesApi.create(v);
      const newV = { ...v, id: v.id || `VH-${Date.now().toString().slice(-6)}` } as Vehicle;
      setLocalData((prev) => [newV, ...prev]);
      return Promise.resolve(newV);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vehicle> }) => {
      if (apiMode) return vehiclesApi.update(id, data);
      setLocalData((prev) => prev.map((v) => (v.id === id ? { ...v, ...data } : v)));
      return Promise.resolve({} as Vehicle);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return vehiclesApi.delete(id);
      setLocalData((prev) => prev.filter((v) => v.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<Vehicle>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    setData: setLocalData,
  };
}

// ═══════════════════════════════════════════
// PHONE FLEET
// ═══════════════════════════════════════════
export function usePhones() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<PhoneDevice>("safeone_phones", mockPhones);

  const query = useQuery({
    queryKey: ["phones"],
    queryFn: () => (apiMode ? phonesApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (p: Omit<PhoneDevice, "id"> & { id?: string }) => {
      if (apiMode) return phonesApi.create(p);
      const newP = { ...p, id: p.id || `PH-${Date.now().toString().slice(-6)}` } as PhoneDevice;
      setLocalData((prev) => [newP, ...prev]);
      return Promise.resolve(newP);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phones"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PhoneDevice> }) => {
      if (apiMode) return phonesApi.update(id, data);
      setLocalData((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
      return Promise.resolve({} as PhoneDevice);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phones"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return phonesApi.delete(id);
      setLocalData((prev) => prev.filter((p) => p.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phones"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<PhoneDevice>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    setData: setLocalData,
  };
}

// ═══════════════════════════════════════════
// ARMED PERSONNEL
// ═══════════════════════════════════════════
export function useArmedPersonnel() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<ArmedPersonnel>("safeone_personnel", mockArmedPersonnel);

  const query = useQuery({
    queryKey: ["armed-personnel"],
    queryFn: () => (apiMode ? personnelApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (p: Omit<ArmedPersonnel, "id"> & { id?: string }) => {
      if (apiMode) return personnelApi.create(p);
      const newP = { ...p, id: p.id || `AP-${Date.now().toString().slice(-6)}` } as ArmedPersonnel;
      setLocalData((prev) => [newP, ...prev]);
      return Promise.resolve(newP);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["armed-personnel"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ArmedPersonnel> }) => {
      if (apiMode) return personnelApi.update(id, data);
      setLocalData((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
      return Promise.resolve({} as ArmedPersonnel);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["armed-personnel"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return personnelApi.delete(id);
      setLocalData((prev) => prev.filter((p) => p.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["armed-personnel"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<ArmedPersonnel>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    setData: setLocalData,
  };
}

// ═══════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════
export function useNotificationsApi(userId?: string) {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();

  const query = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => {
      if (!apiMode || !userId) return Promise.resolve([] as AppNotification[]);
      return notificationsApi.getForUser(userId);
    },
    enabled: apiMode && !!userId,
    staleTime: 10_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(userId || ""),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
  };
}

// ═══════════════════════════════════════════
// PURCHASE REQUESTS
// ═══════════════════════════════════════════
export function usePurchaseRequests() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<PurchaseRequest>("safeone_purchase_requests", []);

  const query = useQuery({
    queryKey: ["purchase-requests"],
    queryFn: () => (apiMode ? purchaseRequestsApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (pr: Omit<PurchaseRequest, "id"> & { id?: string }) => {
      if (apiMode) return purchaseRequestsApi.create(pr);
      const newPR = { ...pr, id: pr.id || `PR-${Date.now().toString().slice(-6)}` } as PurchaseRequest;
      setLocalData((prev) => [newPR, ...prev]);
      return Promise.resolve(newPR);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-requests"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PurchaseRequest> }) => {
      if (apiMode) return purchaseRequestsApi.update(id, data);
      setLocalData((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
      return Promise.resolve({} as PurchaseRequest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-requests"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return purchaseRequestsApi.delete(id);
      setLocalData((prev) => prev.filter((p) => p.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-requests"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<PurchaseRequest>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    setData: setLocalData,
  };
}

// ═══════════════════════════════════════════
// HIRING REQUESTS
// ═══════════════════════════════════════════
export function useHiringRequests() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<HiringRequest>("safeone_hiring_requests", []);

  const query = useQuery({
    queryKey: ["hiring-requests"],
    queryFn: () => (apiMode ? hiringRequestsApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (hr: Omit<HiringRequest, "id"> & { id?: string }) => {
      if (apiMode) return hiringRequestsApi.create(hr);
      const newHR = { ...hr, id: hr.id || `HR-${Date.now().toString().slice(-6)}` } as HiringRequest;
      setLocalData((prev) => [newHR, ...prev]);
      return Promise.resolve(newHR);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hiring-requests"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HiringRequest> }) => {
      if (apiMode) return hiringRequestsApi.update(id, data);
      setLocalData((prev) => prev.map((h) => (h.id === id ? { ...h, ...data } : h)));
      return Promise.resolve({} as HiringRequest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hiring-requests"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return hiringRequestsApi.delete(id);
      setLocalData((prev) => prev.filter((h) => h.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hiring-requests"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<HiringRequest>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    setData: setLocalData,
  };
}

// ═══════════════════════════════════════════
// MINOR PURCHASES
// ═══════════════════════════════════════════
export function useMinorPurchases() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<MinorPurchase>("safeone_minor_purchases", []);

  const query = useQuery({
    queryKey: ["minor-purchases"],
    queryFn: () => (apiMode ? minorPurchasesApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (mp: Omit<MinorPurchase, "id"> & { id?: string }) => {
      if (apiMode) return minorPurchasesApi.create(mp);
      const newMP = { ...mp, id: mp.id || `MP-${Date.now().toString().slice(-6)}` } as MinorPurchase;
      setLocalData((prev) => [newMP, ...prev]);
      return Promise.resolve(newMP);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["minor-purchases"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MinorPurchase> }) => {
      if (apiMode) return minorPurchasesApi.approve(id, { by: "" });
      setLocalData((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
      return Promise.resolve({} as MinorPurchase);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["minor-purchases"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: (id: string, data: Partial<MinorPurchase>) => updateMutation.mutateAsync({ id, data }),
    setData: setLocalData,
  };
}

// ═══════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════
export function useTasks() {
  const queryClient = useQueryClient();
  const apiMode = isApiConfigured();
  const [localData, setLocalData] = useLocalState<any>("safeone_tasks", []);

  const query = useQuery({
    queryKey: ["tasks"],
    queryFn: () => (apiMode ? tasksApi.getAll() : Promise.resolve(localData)),
    initialData: apiMode ? undefined : localData,
    staleTime: apiMode ? 30_000 : Infinity,
  });

  const createMutation = useMutation({
    mutationFn: (task: any) => {
      if (apiMode) return tasksApi.create(task);
      const newTask = { ...task, id: task.id || `TSK-${Date.now().toString().slice(-6)}` };
      setLocalData((prev) => [newTask, ...prev]);
      return Promise.resolve(newTask);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => {
      if (apiMode) return tasksApi.update(id, data);
      setLocalData((prev) => prev.map((t: any) => (t.id === id ? { ...t, ...data } : t)));
      return Promise.resolve({});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (apiMode) return tasksApi.delete(id);
      setLocalData((prev) => prev.filter((t: any) => t.id !== id));
      return Promise.resolve();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return {
    data: apiMode ? query.data || [] : localData,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
