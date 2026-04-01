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
import General from "./pages/General";
import Adonis from "./pages/Adonis";
import Presentation from "./pages/Presentation";
import DepartmentProcesses from "./pages/DepartmentProcesses";
import AuditLog from "./pages/AuditLog";
import Reports from "./pages/Reports";
import TechTasks from "./pages/TechTasks";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, isLoading, activeUsers } = useAuth();
  const chatCtx = useChatContextSafe();

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

  const today = new Date();
  const todayStr = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const birthdayUsers = (activeUsers || []).filter((u) => u.birthday === todayStr);

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
        <Route path="/solicitudes-compra" element={<PurchaseRequests />} />
        <Route path="/solicitudes-personal" element={<HiringRequests />} />
        <Route path="/rrhh/formularios" element={<HRForms />} />
        <Route path="/admin/formularios" element={<AdminForms />} />
        <Route path="/monitoreo" element={<MonitoringCenter />} />
        <Route path="/centro-operaciones" element={<OperationsCenter />} />
        <Route path="/basc" element={<BASC />} />
        <Route path="/archivos" element={<SharedFiles />} />
        <Route path="/procedimientos" element={<Procedures />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/encuestas" element={<Surveys />} />
        <Route path="/gastos-menores" element={<MinorPurchases />} />
        <Route path="/general" element={<General />} />
        <Route path="/adonis" element={<Adonis />} />
        <Route path="/admin/usuarios" element={<UserManagement />} />
        <Route path="/procesos" element={<DepartmentProcesses />} />
        <Route path="/auditoria" element={<AuditLog />} />
        <Route path="/reportes" element={<Reports />} />
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
                  <Route path="/presentacion" element={<Presentation />} />
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
                <ChatWindow />
                <ChatNotificationToast />
                <PanicButton />
                <NotificationOverlay />
                
              </ChatProvider>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
