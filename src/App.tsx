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
import Wiki from "./pages/Wiki";
import TaskInbox from "./pages/TaskInbox";
import MonitoringCenter from "./pages/MonitoringCenter";
import OperationsCenter from "./pages/OperationsCenter";
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
import HRBirthdays from "./pages/HRBirthdays";
import OperationsInventory from "./pages/OperationsInventory";
import AuditConsolidated from "./pages/AuditConsolidated";
import PhotoSync from "./pages/PhotoSync";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, isLoading, activeUsers } = useAuth();
  const chatCtx = useChatContextSafe();
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    import("@/lib/api").then(({ employeesApi }) => {
      employeesApi.getAll().then(setEmployees).catch(() => {});
    });
    // Re-render cada minuto para que la hora del overlay automático se active
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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

  const today = now;
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Hora configurable a partir de la cual aparece el overlay automático (HH:MM, default 08:00)
  const autoTime = (typeof window !== "undefined" && localStorage.getItem("safeone_bday_auto_time")) || "08:00";
  const [autoH, autoM] = autoTime.split(":").map((n) => parseInt(n, 10) || 0);
  const minutesNow = today.getHours() * 60 + today.getMinutes();
  const minutesTarget = autoH * 60 + autoM;
  const timeReached = minutesNow >= minutesTarget;

  // Cumpleaños desde usuarios con campo `birthday` (MM-DD) y empleados del seed (birthDate ISO)
  const fromUsers = (activeUsers || []).filter((u) => u.birthday === todayMMDD);
  const fromEmployees = (employees || [])
    .filter((e: any) => e.status === "Activo" && e.birthDate && e.birthDate.slice(5, 10) === todayMMDD)
    .filter((e: any) => !fromUsers.find((u) => u.fullName.toLowerCase() === String(e.fullName).toLowerCase()))
    .map((e: any) => ({
      id: `EMP-${e.employeeCode}`,
      fullName: e.fullName,
      email: "",
      department: e.department,
      position: e.position,
      birthday: todayMMDD,
      photoUrl: "",
      allowedDepartments: [],
      isAdmin: false,
      extension: "",
    }));
  const birthdayUsers = timeReached ? [...fromUsers, ...fromEmployees] : [];

  return (
    <>
      <BirthdayOverlay
        birthdayUsers={birthdayUsers}
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
        <Route path="/kpis" element={<KPIDashboard />} />
        <Route path="/tareas" element={<TaskInbox />} />
        <Route path="/directorio" element={<Directory />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/inventario" element={<Inventory />} />
        <Route path="/flotilla" element={<Fleet />} />
        <Route path="/flota-celular" element={<PhoneFleet />} />
        <Route path="/operaciones" element={<Operations />} />
        <Route path="/operaciones/inventario" element={<OperationsInventory />} />
        <Route path="/operaciones/auditoria" element={<AuditConsolidated />} />
        <Route path="/solicitudes-compra" element={<PurchaseRequests />} />
        <Route path="/solicitudes-personal" element={<HiringRequests />} />
        <Route path="/rrhh/formularios" element={<HRForms />} />
        <Route path="/rrhh/consolidado-nomina" element={<HRPayrollReport />} />
        <Route path="/rrhh/empleados" element={<EmployeeDirectory />} />
        <Route path="/rrhh/nomina" element={<Payroll />} />
        <Route path="/rrhh/beneficios" element={<HRBenefits />} />
        <Route path="/rrhh/horas-extras" element={<PayrollExtrasPage />} />
        <Route path="/rrhh/cumpleanos" element={<HRBirthdays />} />
        <Route path="/admin/formularios" element={<AdminForms />} />
        <Route path="/admin/hub" element={<AdminHub />} />
        <Route path="/admin/flotilla-mantenimiento" element={<FleetMaintenance />} />
        <Route path="/monitoreo" element={<MonitoringCenter />} />
        <Route path="/centro-operaciones" element={<OperationsCenter />} />
        <Route path="/basc" element={<BASC />} />
        <Route path="/archivos" element={<SharedFiles />} />
        <Route path="/procedimientos" element={<Procedures />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/encuestas" element={<Surveys />} />
        <Route path="/gastos-menores" element={<MinorPurchases />} />
        <Route path="/admin/caja-chica" element={<MinorPurchases />} />
        <Route path="/admin/tarjetas-corporativas" element={<CorporateCards />} />
        <Route path="/admin/usuarios" element={<UserManagement />} />
        <Route path="/procesos" element={<DepartmentProcesses />} />
        <Route path="/auditoria" element={<AuditLog />} />
        <Route path="/reportes" element={<Reports />} />
        <Route path="/tech-tasks" element={<TechTasks />} />
        <Route path="/seguimiento-clientes" element={<ClientTracking />} />
        <Route path="/capacitaciones" element={<Training />} />
        <Route path="/admin/sincronizar-fotos" element={<PhotoSync />} />
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
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
                <ChatWindow />
                <ChatNotificationToast />
                <PanicButton />
                <NotificationOverlay />
                <HRNotificationOverlay />
                
              </ChatProvider>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
