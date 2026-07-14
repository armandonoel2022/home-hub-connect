import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ChatProvider, useChatContextSafe } from "@/contexts/ChatContext";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatNotificationToast from "@/components/chat/ChatNotificationToast";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import PanicButton from "@/components/PanicButton";
import NotificationOverlay from "@/components/NotificationOverlay";
import HRNotificationOverlay from "@/components/HRNotificationOverlay";
import DeviceRegisterOverlay from "@/components/DeviceRegisterOverlay";
import Index from "./pages/Index";
import Tickets from "./pages/Tickets";
import Inventory from "./pages/Inventory";
import Fleet from "./pages/Fleet";
import PhoneFleet from "./pages/PhoneFleet";
import Operations from "./pages/Operations";
import BASC from "./pages/BASC";
import PurchaseRequests from "./pages/PurchaseRequests";
import HiringRequests from "./pages/HiringRequests";
import HRForms from "./pages/HRForms";
import HRPayrollReport from "./pages/HRPayrollReport";
import HRBenefits from "./pages/HRBenefits";
import AdminForms from "./pages/AdminForms";
import UserManagement from "./pages/UserManagement";
import Directory from "./pages/Directory";
import CalendarPage from "./pages/CalendarPage";
import SharedFiles from "./pages/SharedFiles";
import Procedures from "./pages/Procedures";
import KPIDashboard from "./pages/KPIDashboard";
import Surveys from "./pages/Surveys";
import VacationProvisioning from "./pages/VacationProvisioning";
import Wiki from "./pages/Wiki";
import TaskInbox from "./pages/TaskInbox";
import MonitoringCenter from "./pages/MonitoringCenter";
import OperationsCenter from "./pages/OperationsCenter";
import ClientExpediente from "./pages/ClientExpediente";
import WeaponVault from "./pages/WeaponVault";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import MinorPurchases from "./pages/MinorPurchases";
import CorporateCards from "./pages/CorporateCards";
import Presentation from "./pages/Presentation";
import DepartmentProcesses from "./pages/DepartmentProcesses";
import AuditLog from "./pages/AuditLog";
import Reports from "./pages/Reports";
import TechTasks from "./pages/TechTasks";
import ClientTracking from "./pages/ClientTracking";
import AdminHub from "./pages/AdminHub";
import FleetMaintenance from "./pages/FleetMaintenance";
import Training from "./pages/Training";
import Kiosk from "./pages/Kiosk";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import Payroll from "./pages/Payroll";
import PayrollExtrasPage from "./pages/PayrollExtras";
import PayrollAnalytics from "./pages/PayrollAnalytics";
import HRBirthdays from "./pages/HRBirthdays";
import OperationsInventory from "./pages/OperationsInventory";
import OperationsMaintenanceMatrix from "./pages/OperationsMaintenanceMatrix";

import AuditConsolidated from "./pages/AuditConsolidated";
import PhotoSync from "./pages/PhotoSync";
import MyHRRequests from "./pages/MyHRRequests";
import HRApprovals from "./pages/HRApprovals";
import LoanControl from "./pages/LoanControl";
import HRApprovalPrint from "./pages/HRApprovalPrint";
import HRConsolidated from "./pages/HRConsolidated";
import HRConstancias from "./pages/HRConstancias";
import AdminFolderPermissions from "./pages/AdminFolderPermissions";
import NotFound from "./pages/NotFound";
import RouteGuard from "@/components/RouteGuard";
import AnnouncementOverlay from "@/components/AnnouncementOverlay";
import SurveyOverlay from "@/components/SurveyOverlay";
import SurveyPublic from "./pages/SurveyPublic";


const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, isLoading, activeUsers } = useAuth();
  const chatCtx = useChatContextSafe();
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [now, setNow] = React.useState(() => new Date());
  const [enrichedBirthday, setEnrichedBirthday] = React.useState<any[]>([]);
  const [birthdayPhotoOverrides, setBirthdayPhotoOverrides] = React.useState<Record<string, { photoUrl: string; fullName?: string; updatedAt?: string }>>({});

  React.useEffect(() => {
    import("@/lib/api").then(({ employeesApi }) => {
      employeesApi.getAll().then(setEmployees).catch(() => {});
    });
    // Inicializar sincronización backend de solicitudes RRHH (compartido entre usuarios)
    import("@/lib/hrRequestService").then(({ initHRRequestsSync }) => {
      try { initHRRequestsSync(); } catch {}
    });
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const today = now;
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const autoTime = (typeof window !== "undefined" && localStorage.getItem("safeone_bday_auto_time")) || "08:00";
  const [autoH, autoM] = autoTime.split(":").map((n) => parseInt(n, 10) || 0);
  const minutesNow = today.getHours() * 60 + today.getMinutes();
  const minutesTarget = autoH * 60 + autoM;
  const timeReached = minutesNow >= minutesTarget;

  const fromUsers = (activeUsers || []).filter((u) => u.birthday === todayMMDD);

  // Excepción: para "Brandon", siempre usar la foto cargada en Gestión de Usuarios
  const normalizeName = (s: string) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const brandonUser = (activeUsers || []).find((u) =>
    normalizeName(u.fullName).startsWith("brandon diaz")
  );
  const brandonBirthdayOverride = birthdayPhotoOverrides.brandon?.photoUrl || "";

  const fromEmployees = (employees || [])
    .filter((e: any) => e.status === "Activo" && e.birthDate && e.birthDate.slice(5, 10) === todayMMDD)
    .filter((e: any) => !fromUsers.find((u) => u.fullName.toLowerCase() === String(e.fullName).toLowerCase()))
    .map((e: any) => {
      const isBrandon = normalizeName(e.fullName).startsWith("brandon diaz");
      const overridePhoto = isBrandon ? (brandonBirthdayOverride || brandonUser?.photoUrl || "") : "";
      return {
        id: `EMP-${e.employeeCode}`,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        cedula: e.cedula || e.tss || "",
        email: e.email || "",
        department: e.department,
        position: e.position,
        birthday: todayMMDD,
        photoUrl: overridePhoto || e.photoUrl || e.photo || "",
        allowedDepartments: [],
        isAdmin: false,
        extension: "",
      };
    });
  // Excepción Brandon: si aparece por fromUsers, forzamos su foto de Gestión de Usuarios
  const fromUsersFixed = fromUsers.map((u) => {
    if (normalizeName(u.fullName).startsWith("brandon diaz") && (brandonBirthdayOverride || brandonUser?.photoUrl)) {
      return { ...u, photoUrl: brandonBirthdayOverride || brandonUser?.photoUrl || u.photoUrl };
    }
    return u;
  });
  const baseBirthday = (user && timeReached) ? [...fromUsersFixed, ...fromEmployees] : [];
  const birthdayKey = baseBirthday.map((u) => u.id).join("|");

  // Enriquecer con fotos provenientes de las carpetas locales (FOTOS y dist/fotos_empleados)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!baseBirthday.length) { setEnrichedBirthday([]); return; }
      const { photoSyncApi } = await import("@/lib/api");
      const out = await Promise.all(baseBirthday.map(async (u) => {
        if (u.photoUrl) return u;
        try {
          const r = await photoSyncApi.find(u.fullName, { employeeCode: u.employeeCode, cedula: u.cedula });
          if (r?.match?.url) return { ...u, photoUrl: r.match.url };
        } catch { /* ignore */ }
        return u;
      }));
      if (!cancelled) setEnrichedBirthday(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthdayKey]);

  React.useEffect(() => {
    if (!user) return;
    try {
      const local = localStorage.getItem("safeone_birthday_photo_overrides");
      if (local) setBirthdayPhotoOverrides(JSON.parse(local));
    } catch {}

    let cancelled = false;
    import("@/lib/api").then(({ isApiConfigured, usersApi }) => {
      if (!isApiConfigured()) return;
      usersApi.getBirthdayPhotoOverrides()
        .then((overrides) => {
          if (!cancelled) {
            setBirthdayPhotoOverrides(overrides || {});
            localStorage.setItem("safeone_birthday_photo_overrides", JSON.stringify(overrides || {}));
          }
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const birthdayUsers = enrichedBirthday.length ? enrichedBirthday : baseBirthday;
  const canManageBirthdayPhoto = (user.email || "").toLowerCase() === "anoel@safeone.com.do";

  return (
    <>
      <BirthdayOverlay
        birthdayUsers={birthdayUsers}
        canManageBirthdayPhoto={canManageBirthdayPhoto}
        onBirthdayPhotoChange={canManageBirthdayPhoto ? async (_bdayUser, photoDataUrl, fileName) => {
          const applyLocal = (photoUrl: string, updatedAt = new Date().toISOString()) => {
            const next = {
              ...birthdayPhotoOverrides,
              brandon: { fullName: "Brandon Díaz", photoUrl, updatedAt },
            };
            setBirthdayPhotoOverrides(next);
            localStorage.setItem("safeone_birthday_photo_overrides", JSON.stringify(next));
            setEnrichedBirthday((prev) => prev.map((u) => normalizeName(u.fullName).startsWith("brandon diaz") ? { ...u, photoUrl } : u));
          };

          const { isApiConfigured, usersApi } = await import("@/lib/api");
          if (isApiConfigured()) {
            const saved = await usersApi.updateBrandonBirthdayPhoto(photoDataUrl, fileName);
            applyLocal(saved.photoUrl, saved.updatedAt);
          } else {
            applyLocal(photoDataUrl);
          }
        } : undefined}
        onSendCongrats={(bdayUser) => {
          if (chatCtx) {
            chatCtx.startIndividualChat(bdayUser.id);
            setTimeout(() => {
              chatCtx.sendMessage(`🎂🎉 ¡Feliz Cumpleaños, ${bdayUser.fullName}! De parte de SafeOne Security Company te deseamos un maravilloso día lleno de éxitos y bendiciones. 🥳`);
            }, 500);
          }
        }}
      />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/provisionamiento-vacaciones" element={<RouteGuard module="vacations"><VacationProvisioning /></RouteGuard>} />
        <Route path="/kpis" element={<RouteGuard module="kpis"><KPIDashboard /></RouteGuard>} />
        <Route path="/tareas" element={<RouteGuard module="tasks"><TaskInbox /></RouteGuard>} />
        <Route path="/directorio" element={<Directory />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/tickets" element={<RouteGuard module="tickets"><Tickets /></RouteGuard>} />
        <Route path="/inventario" element={<RouteGuard module="itInventory"><Inventory /></RouteGuard>} />
        <Route path="/flotilla" element={<RouteGuard module="fleet"><Fleet /></RouteGuard>} />
        <Route path="/flota-celular" element={<RouteGuard module="phoneFleet"><PhoneFleet /></RouteGuard>} />
        <Route path="/operaciones" element={<RouteGuard module="armedPersonnel"><Operations /></RouteGuard>} />
        <Route path="/operaciones/inventario" element={<RouteGuard module="uniforms"><OperationsInventory /></RouteGuard>} />
        <Route path="/operaciones/auditoria" element={<RouteGuard module="superintAudit"><AuditConsolidated /></RouteGuard>} />
        <Route path="/solicitudes-compra" element={<RouteGuard module="purchaseRequests"><PurchaseRequests /></RouteGuard>} />
        <Route path="/solicitudes-personal" element={<RouteGuard module="hiringRequests"><HiringRequests /></RouteGuard>} />
        <Route path="/rrhh/formularios" element={<HRForms />} />
        <Route path="/rrhh/consolidado-nomina" element={<HRPayrollReport />} />
        <Route path="/rrhh/empleados" element={<EmployeeDirectory />} />
        <Route path="/rrhh/nomina" element={<Payroll />} />
        <Route path="/rrhh/beneficios" element={<HRBenefits />} />
        <Route path="/rrhh/horas-extras" element={<PayrollExtrasPage />} />
        <Route path="/rrhh/nomina-analitica" element={<PayrollAnalytics />} />
        <Route path="/rrhh/cumpleanos" element={<HRBirthdays />} />
        <Route path="/admin/formularios" element={<RouteGuard module="adminForms"><AdminForms /></RouteGuard>} />
        <Route path="/admin/hub" element={<RouteGuard module="adminHub"><AdminHub /></RouteGuard>} />
        <Route path="/admin/flotilla-mantenimiento" element={<FleetMaintenance />} />
        <Route path="/monitoreo" element={<MonitoringCenter />} />
        <Route path="/operaciones/matriz-mantenimiento" element={<RouteGuard module="maintenanceMatrix"><OperationsMaintenanceMatrix /></RouteGuard>} />
        <Route path="/operaciones/expediente" element={<RouteGuard module="clientExpediente"><ClientExpediente /></RouteGuard>} />
        <Route path="/operaciones/boveda" element={<RouteGuard module="weaponVault"><WeaponVault /></RouteGuard>} />
        <Route path="/operaciones/puestos" element={<Navigate to="/operaciones" replace />} />
        <Route path="/rrhh/mis-solicitudes" element={<MyHRRequests />} />
        <Route path="/rrhh/aprobaciones" element={<RouteGuard module="hrApprovals"><HRApprovals /></RouteGuard>} />
        <Route path="/rrhh/prestamos-control" element={<RouteGuard module="hrApprovals"><LoanControl /></RouteGuard>} />
        <Route path="/rrhh/consolidado" element={<RouteGuard module="hrConsolidated"><HRConsolidated /></RouteGuard>} />
        <Route path="/rrhh/imprimir/:id" element={<HRApprovalPrint />} />
        <Route path="/rrhh/constancias" element={<RouteGuard module="hrConstancias"><HRConstancias /></RouteGuard>} />
        <Route path="/centro-operaciones" element={<OperationsCenter />} />
        <Route path="/basc" element={<RouteGuard module="basc"><BASC /></RouteGuard>} />
        <Route path="/archivos" element={<SharedFiles />} />
        <Route path="/procedimientos" element={<Procedures />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/encuestas" element={<Surveys />} />
        <Route path="/gastos-menores" element={<RouteGuard module="minorPurchases"><MinorPurchases /></RouteGuard>} />
        <Route path="/admin/caja-chica" element={<RouteGuard module="minorPurchases"><MinorPurchases /></RouteGuard>} />
        <Route path="/admin/tarjetas-corporativas" element={<CorporateCards />} />
        <Route path="/admin/usuarios" element={<RouteGuard module="userManagement"><UserManagement /></RouteGuard>} />
        <Route path="/procesos" element={<DepartmentProcesses />} />
        <Route path="/auditoria" element={<RouteGuard module="auditLog"><AuditLog /></RouteGuard>} />
        <Route path="/reportes" element={<RouteGuard module="reports"><Reports /></RouteGuard>} />
        <Route path="/tech-tasks" element={<RouteGuard module="techTasks"><TechTasks /></RouteGuard>} />
        <Route path="/seguimiento-clientes" element={<RouteGuard module="clientTracking"><ClientTracking /></RouteGuard>} />
        <Route path="/capacitaciones" element={<Training />} />
        <Route path="/admin/sincronizar-fotos" element={<RouteGuard module="photoSync"><PhotoSync /></RouteGuard>} />
        <Route path="/admin/permisos-carpetas" element={<RouteGuard module="folderPermissions"><AdminFolderPermissions /></RouteGuard>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <ChatProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/registro" element={<RegisterPage />} />
                  <Route path="/kiosko" element={<Kiosk />} />
                  <Route path="/presentacion" element={<Presentation />} />
                  <Route path="/encuesta/:id" element={<SurveyPublic />} />
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
                <ChatWindow />
                <ChatNotificationToast />
                <PanicButton />
                <NotificationOverlay />
                <HRNotificationOverlay />
                <DeviceRegisterOverlay />
                <AnnouncementOverlay />
                <SurveyOverlay />
                
              </ChatProvider>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
