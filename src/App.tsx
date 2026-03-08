import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ChatProvider } from "@/contexts/ChatContext";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatNotificationToast from "@/components/chat/ChatNotificationToast";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import PanicButton from "@/components/PanicButton";
import NotificationOverlay from "@/components/NotificationOverlay";
import NotificationDemo from "@/components/NotificationDemo";
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
import UserManagement from "./pages/UserManagement";
import Directory from "./pages/Directory";
import CalendarPage from "./pages/CalendarPage";
import SharedFiles from "./pages/SharedFiles";
import Procedures from "./pages/Procedures";
import KPIDashboard from "./pages/KPIDashboard";
import Surveys from "./pages/Surveys";
import Wiki from "./pages/Wiki";
import TaskInbox from "./pages/TaskInbox";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import NotFound from "./pages/NotFound";
import type { IntranetUser } from "./lib/types";

const queryClient = new QueryClient();

// Mock birthday users — replace with API call
const getBirthdayUsers = (): IntranetUser[] => {
  const today = new Date();
  const todayStr = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const allUsers: IntranetUser[] = [
    { id: "USR-004", fullName: "Carlos Méndez", email: "carlos.mendez@safeone.com", department: "Contabilidad", position: "Contador", birthday: "03-05", photoUrl: "", allowedDepartments: ["Contabilidad"], isAdmin: false },
  ];
  return allUsers.filter((u) => u.birthday === todayStr);
};

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

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

  const birthdayUsers = getBirthdayUsers();

  return (
    <>
      <BirthdayOverlay birthdayUsers={birthdayUsers} />
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
        <Route path="/basc" element={<BASC />} />
        <Route path="/archivos" element={<SharedFiles />} />
        <Route path="/procedimientos" element={<Procedures />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/encuestas" element={<Surveys />} />
        <Route path="/admin/usuarios" element={<UserManagement />} />
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
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
                <ChatWindow />
                <ChatNotificationToast />
                <PanicButton />
                <NotificationOverlay />
                <NotificationDemo />
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
