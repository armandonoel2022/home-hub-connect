import { useState, useEffect, useCallback } from "react";
import { INITIAL_OBJECTIVES, type BASCObjective } from "@/lib/bascData";
import { INITIAL_DEPARTMENT_KPIS, type DepartmentKPI } from "@/lib/kpiTypes";
import { isApiConfigured } from "@/lib/api";
import { kpisApi } from "@/lib/api";

const BASC_STORAGE_KEY = "safeone-basc-objectives-v2";
const DKPI_STORAGE_KEY = "safeone-dept-kpis-v2";

export function useKPIData() {
  const apiMode = isApiConfigured();

  const [objectives, setObjectives] = useState<BASCObjective[]>(() => {
    if (apiMode) return INITIAL_OBJECTIVES;
    const saved = localStorage.getItem(BASC_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_OBJECTIVES;
  });

  const [deptKPIs, setDeptKPIs] = useState<DepartmentKPI[]>(() => {
    if (apiMode) return INITIAL_DEPARTMENT_KPIS;
    const saved = localStorage.getItem(DKPI_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DEPARTMENT_KPIS;
  });

  // Load from server on mount
  useEffect(() => {
    if (!apiMode) return;
    kpisApi.getObjectives().then(data => {
      if (data && data.length > 0) setObjectives(data);
    }).catch(() => {});
    kpisApi.getDeptKPIs().then(data => {
      if (data && data.length > 0) setDeptKPIs(data);
    }).catch(() => {});
  }, [apiMode]);

  // Save to localStorage in mock mode
  useEffect(() => {
    if (!apiMode) localStorage.setItem(BASC_STORAGE_KEY, JSON.stringify(objectives));
  }, [objectives, apiMode]);

  useEffect(() => {
    if (!apiMode) localStorage.setItem(DKPI_STORAGE_KEY, JSON.stringify(deptKPIs));
  }, [deptKPIs, apiMode]);

  const updateObjective = useCallback((id: string, updates: Partial<BASCObjective>) => {
    setObjectives((prev) => {
      const updated = prev.map((o) => (o.id === id ? { ...o, ...updates } : o));
      if (apiMode) kpisApi.updateObjective(id, updates).catch(() => {});
      return updated;
    });
  }, [apiMode]);

  const addDeptKPI = useCallback((kpi: DepartmentKPI) => {
    setDeptKPIs((prev) => {
      const updated = [...prev, kpi];
      if (apiMode) kpisApi.createDeptKPI(kpi).catch(() => {});
      return updated;
    });
  }, [apiMode]);

  const updateDeptKPI = useCallback((id: string, updates: Partial<DepartmentKPI>) => {
    setDeptKPIs((prev) => {
      const updated = prev.map((k) => (k.id === id ? { ...k, ...updates } : k));
      if (apiMode) kpisApi.updateDeptKPI(id, updates).catch(() => {});
      return updated;
    });
  }, [apiMode]);

  const deleteDeptKPI = useCallback((id: string) => {
    setDeptKPIs((prev) => {
      const updated = prev.filter((k) => k.id !== id);
      if (apiMode) kpisApi.deleteDeptKPI(id).catch(() => {});
      return updated;
    });
  }, [apiMode]);

  return { objectives, updateObjective, deptKPIs, addDeptKPI, updateDeptKPI, deleteDeptKPI };
}
