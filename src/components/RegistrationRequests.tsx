import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { RegistrationRequest } from "@/lib/registrationTypes";
import type { IntranetUser } from "@/lib/types";
import { notifyRegistrationApproved, notifyRegistrationRejected } from "@/lib/emailService";
import { UserPlus, Check, X, Clock, AlertCircle } from "lucide-react";

const STORAGE_KEY = "safeone_registration_requests";

function getRequests(): RegistrationRequest[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveRequests(reqs: RegistrationRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reqs));
}

export default function RegistrationRequests() {
  const { user, allUsers, addUser } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    setRequests(getRequests());
  }, []);

  if (!user) return null;

  // Show only requests for departments this user leads (or all if admin)
  const visible = requests.filter((r) => {
    if (user.isAdmin) return true;
    if (user.isDepartmentLeader && user.department === r.department) return true;
    return false;
  });

  const pending = visible.filter((r) => r.status === "pendiente");

  if (pending.length === 0) return null;

  const approve = (req: RegistrationRequest) => {
    const newUser: IntranetUser = {
      id: `USR-${Date.now().toString().slice(-6)}`,
      fullName: req.fullName,
      email: req.email,
      department: req.department,
      position: req.position,
      birthday: req.birthday,
      photoUrl: "",
      allowedDepartments: [req.department],
      isAdmin: false,
      reportsTo: user.isDepartmentLeader ? user.id : "",
    };
    addUser(newUser);

    const updated = getRequests().map((r) =>
      r.id === req.id
        ? { ...r, status: "aprobado" as const, reviewedBy: user.fullName, reviewedAt: new Date().toISOString() }
        : r
    );
    saveRequests(updated);
    setRequests(updated);

    notifyRegistrationApproved(req.email, req.fullName);
  };

  const reject = (reqId: string) => {
    if (!rejectionReason.trim()) return;
    const req = requests.find((r) => r.id === reqId);
    const updated = getRequests().map((r) =>
      r.id === reqId
        ? { ...r, status: "rechazado" as const, reviewedBy: user.fullName, reviewedAt: new Date().toISOString(), rejectionReason: rejectionReason.trim() }
        : r
    );
    saveRequests(updated);
    setRequests(updated);
    setRejectingId(null);
    setRejectionReason("");

    if (req) notifyRegistrationRejected(req.email, req.fullName, rejectionReason.trim());
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-gold/5">
        <UserPlus className="h-5 w-5 text-gold" />
        <h3 className="font-heading font-bold text-card-foreground">
          Solicitudes de Acceso Pendientes
        </h3>
        <span className="ml-auto text-xs font-bold bg-gold/20 gold-accent-text px-2 py-0.5 rounded-full">
          {pending.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {pending.map((req) => (
          <div key={req.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-card-foreground">{req.fullName}</p>
                <p className="text-xs text-muted-foreground">{req.email} — {req.department}</p>
                <p className="text-xs text-muted-foreground">{req.position}</p>
                {req.justification && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{req.justification}"</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(req.requestedAt).toLocaleString("es-DO")}
                </p>
              </div>

              {rejectingId === req.id ? (
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Motivo del rechazo..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-destructive outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(req.id)}
                      disabled={!rejectionReason.trim()}
                      className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium disabled:opacity-50"
                    >
                      Confirmar Rechazo
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                      className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => approve(req)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Aprobar
                  </button>
                  <button
                    onClick={() => setRejectingId(req.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
