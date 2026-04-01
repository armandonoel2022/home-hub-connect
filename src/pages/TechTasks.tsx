import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import AuthGuard from "@/components/tech-tasks/AuthGuard";
import TaskRegister from "@/components/tech-tasks/TaskRegister";
import TaskList from "@/components/tech-tasks/TaskList";
import TaskDashboard from "@/components/tech-tasks/TaskDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, BarChart3, Plus } from "lucide-react";
import { techTaskStorage } from "@/lib/techTaskStorage";
import type { TechTask } from "@/lib/techTaskTypes";

const TechTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TechTask[]>(() =>
    user ? techTaskStorage.getAll(user.email) : []
  );

  const refresh = useCallback(() => {
    if (user) setTasks(techTaskStorage.getAll(user.email));
  }, [user]);

  return (
    <AppLayout>
      <AuthGuard>
        <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Registro de Tareas — Coordinación Tecnología
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.fullName} • {new Date().toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="register" className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Registrar
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4" /> Listado
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Dashboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="mt-4">
              <TaskRegister onTaskAdded={refresh} />
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              <TaskList tasks={tasks} onRefresh={refresh} />
            </TabsContent>

            <TabsContent value="dashboard" className="mt-4">
              <TaskDashboard tasks={tasks} />
            </TabsContent>
          </Tabs>
        </div>
      </AuthGuard>
    </AppLayout>
  );
};

export default TechTasks;
