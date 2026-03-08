import { useState, useEffect } from "react";
import { INITIAL_OBJECTIVES, type BASCObjective } from "@/lib/bascData";
import { INITIAL_DEPARTMENT_KPIS, type DepartmentKPI } from "@/lib/kpiTypes";

const BASC_STORAGE_KEY = "safeone-basc-objectives-v1";
const DKPI_STORAGE_KEY = "safeone-dept-kpis-v1";

export function useKPIData() {
  const [objectives, setObjectives] = useState<BASCObjective[]>(() => {
    const saved = localStorage.getItem(BASC_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_OBJECTIVES;
  });

  const [deptKPIs, setDeptKPIs] = useState<DepartmentKPI[]>(() => {
    const saved = localStorage.getItem(DKPI_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DEPARTMENT_KPIS;
  });

  useEffect(() => {
    localStorage.setItem(BASC_STORAGE_KEY, JSON.stringify(objectives));
  }, [objectives]);

  useEffect(() => {
    localStorage.setItem(DKPI_STORAGE_KEY, JSON.stringify(deptKPIs));
  }, [deptKPIs]);

  const updateObjective = (id: string, updates: Partial<BASCObjective>) => {
    setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };

  const addDeptKPI = (kpi: DepartmentKPI) => {
    setDeptKPIs((prev) => [...prev, kpi]);
  };

  const updateDeptKPI = (id: string, updates: Partial<DepartmentKPI>) => {
    setDeptKPIs((prev) => prev.map((k) => (k.id === id ? { ...k, ...updates } : k)));
  };

  const deleteDeptKPI = (id: string) => {
    setDeptKPIs((prev) => prev.filter((k) => k.id !== id));
  };

  return { objectives, updateObjective, deptKPIs, addDeptKPI, updateDeptKPI, deleteDeptKPI };
}
