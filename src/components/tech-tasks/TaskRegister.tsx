import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { techTaskStorage } from "@/lib/techTaskStorage";
import type { TechTask, TaskType, TaskStatus, TimeBlock } from "@/lib/techTaskTypes";
import { TASK_TYPE_LABELS, STATUS_LABELS, BLOCK_LABELS } from "@/lib/techTaskTypes";

interface TaskRegisterProps {
  onTaskAdded: () => void;
}

const TaskRegister = ({ onTaskAdded }: TaskRegisterProps) => {
  const { user } = useAuth();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState(nowTime);
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("tecnica");
  const [status, setStatus] = useState<TaskStatus>("completada");
  const [statusDetail, setStatusDetail] = useState("");
  const [dependsOnThird, setDependsOnThird] = useState(false);
  const [thirdPartyName, setThirdPartyName] = useState("");
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [block, setBlock] = useState<TimeBlock>("gestion_rapida");
  const [customBlockName, setCustomBlockName] = useState("");
  const [decisions, setDecisions] = useState("");

  const calcTime = () => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) setTimeSpent(diff);
    }
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error("La descripción es requerida");
      return;
    }

    const task: TechTask = {
      id: `TT-${Date.now()}`,
      date,
      startTime,
      endTime: endTime || undefined,
      description: description.trim(),
      type,
      status,
      statusDetail: status !== "completada" ? statusDetail : undefined,
      dependsOnThirdParty: dependsOnThird,
      thirdPartyName: dependsOnThird ? thirdPartyName : undefined,
      timeSpent: timeSpent || 0,
      notes: notes.trim() || undefined,
      block,
      customBlockName: block === "personalizado" ? customBlockName : undefined,
      decisions: decisions.trim() || undefined,
      createdBy: user!.email,
      createdAt: new Date().toISOString(),
    };

    techTaskStorage.add(task);
    toast.success("Tarea registrada exitosamente");

    // Reset
    const n = new Date();
    setStartTime(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`);
    setEndTime("");
    setDescription("");
    setStatusDetail("");
    setDependsOnThird(false);
    setThirdPartyName("");
    setTimeSpent(0);
    setNotes("");
    setDecisions("");
    onTaskAdded();
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Registrar Nueva Tarea
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Date, Start, End, Auto-calc */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hora Inicio</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hora Fin</Label>
            <Input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); }} onBlur={calcTime} />
          </div>
          <div>
            <Label className="text-xs">Tiempo (min)</Label>
            <div className="flex gap-1">
              <Input type="number" min={0} value={timeSpent} onChange={(e) => setTimeSpent(Number(e.target.value))} />
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={calcTime} title="Calcular automáticamente">
                <Clock className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Row 2: Description */}
        <div>
          <Label className="text-xs">Descripción de la Tarea *</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Agregar impresora a Cristy..." rows={2} />
        </div>

        {/* Row 3: Type, Status, Block */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Tipo de Tarea</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Bloque de Tiempo</Label>
            <Select value={block} onValueChange={(v) => setBlock(v as TimeBlock)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BLOCK_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status detail */}
        {status !== "completada" && (
          <div>
            <Label className="text-xs">Detalle del Estado</Label>
            <Input value={statusDetail} onChange={(e) => setStatusDetail(e.target.value)} placeholder="Ej: En espera de respuesta de Chrisnel" />
          </div>
        )}

        {/* Custom block name */}
        {block === "personalizado" && (
          <div>
            <Label className="text-xs">Nombre del Bloque</Label>
            <Input value={customBlockName} onChange={(e) => setCustomBlockName(e.target.value)} placeholder="Ej: Configuraciones de red" />
          </div>
        )}

        {/* Third party dependency */}
        <div className="flex items-center gap-3">
          <Switch checked={dependsOnThird} onCheckedChange={setDependsOnThird} />
          <Label className="text-sm">¿Depende de un tercero?</Label>
          {dependsOnThird && (
            <Input className="flex-1 max-w-xs" value={thirdPartyName} onChange={(e) => setThirdPartyName(e.target.value)} placeholder="¿De quién?" />
          )}
        </div>

        {/* Notes */}
        <div>
          <Label className="text-xs">Notas Adicionales</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles, observaciones, subtareas..." rows={2} />
        </div>

        {/* Decisions */}
        <div>
          <Label className="text-xs">Decisiones / Acuerdos Importantes</Label>
          <Textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="Acuerdos de reuniones, decisiones clave..." rows={2} />
        </div>

        <Button onClick={handleSubmit} className="w-full">
          <Plus className="w-4 h-4 mr-2" /> Registrar Tarea
        </Button>
      </CardContent>
    </Card>
  );
};

export default TaskRegister;
