import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getHRRequestById } from "@/lib/hrRequestService";
import { HR_FORM_LABELS } from "@/lib/hrRequestTypes";
import { Printer, ArrowLeft } from "lucide-react";

const HRApprovalPrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const req = useMemo(() => (id ? getHRRequestById(id) : undefined), [id]);

  useEffect(() => {
    document.title = req ? `Solicitud ${req.id} — ${HR_FORM_LABELS[req.formType]}` : "Solicitud RRHH";
  }, [req]);

  if (!req) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Solicitud no encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Volver</Button>
        </div>
      </div>
    );
  }

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("es-DO", { dateStyle: "long", timeStyle: "short" }) : "—";

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Toolbar (no print) */}
      <div className="print:hidden sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <Button size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
          </Button>
        </div>
      </div>

      {/* A4 page */}
      <div className="mx-auto my-6 bg-white shadow print:shadow-none p-12 print:p-12"
        style={{ width: "210mm", minHeight: "297mm" }}>
        {/* Header con membrete */}
        <header className="flex items-center justify-between border-b-2 border-amber-500 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <img src="/safeone-letterhead.png" alt="SafeOne" className="h-16 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <div>
              <h1 className="text-xl font-black tracking-tight">SafeOne Security Company</h1>
              <p className="text-xs text-muted-foreground">Recursos Humanos · Solicitud Aprobada</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p><strong>Folio:</strong> {req.id}</p>
            <p><strong>Fecha emisión:</strong> {new Date().toLocaleDateString("es-DO")}</p>
          </div>
        </header>

        <section className="mb-6">
          <h2 className="text-lg font-bold uppercase tracking-wide mb-2 text-amber-700">
            {HR_FORM_LABELS[req.formType]}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm border rounded p-4 bg-muted/20">
            <div><strong>Solicitante:</strong> {req.requestedByName}</div>
            <div><strong>Departamento:</strong> {req.department}</div>
            <div><strong>Fecha de solicitud:</strong> {fmtDate(req.requestedAt)}</div>
            <div><strong>Estado:</strong> {req.status}</div>
            {req.beneficiaryName && <div className="col-span-2"><strong>Beneficiario:</strong> {req.beneficiaryName}</div>}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2 border-b pb-1">Detalle de la solicitud</h3>
          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
            {Object.entries(req.formData).map(([k, v]) => (
              <div key={k} className="border-b border-dashed py-1">
                <span className="text-xs text-muted-foreground block">{k}</span>
                <span className="font-medium">{String(v) || "—"}</span>
              </div>
            ))}
          </div>
        </section>

        {req.loanDetails && (
          <section className="mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-2 border-b pb-1">Detalle financiero del préstamo</h3>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div><strong>Monto solicitado:</strong> RD$ {req.loanDetails.amountRequested.toLocaleString("es-DO")}</div>
              <div><strong>Monto aprobado:</strong> RD$ {(req.loanDetails.approvedAmount ?? req.loanDetails.amountRequested).toLocaleString("es-DO")}</div>
              <div><strong>Plazo (meses):</strong> {req.loanDetails.approvedTermMonths ?? req.loanDetails.termMonths}</div>
              <div><strong>Cuota mensual:</strong> RD$ {(req.loanDetails.approvedInstallment ?? req.loanDetails.monthlyInstallment).toLocaleString("es-DO", { maximumFractionDigits: 2 })}</div>
              <div><strong>Tasa anual:</strong> {req.loanDetails.annualInterestRatePct}%</div>
              <div><strong>Fecha de aplicación:</strong> {req.loanApplyDate || "—"}</div>
              {req.loanDetails.overrideJustification && (
                <div className="col-span-2"><strong>Justificación excepción:</strong> {req.loanDetails.overrideJustification}</div>
              )}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2 border-b pb-1">Trazabilidad de aprobaciones</h3>
          <table className="w-full text-xs mt-2 border-collapse">
            <thead>
              <tr className="bg-muted text-left">
                <th className="border px-2 py-1">Etapa</th>
                <th className="border px-2 py-1">Aprobador</th>
                <th className="border px-2 py-1">Fecha</th>
                <th className="border px-2 py-1">Comentario</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">Supervisor ({req.supervisorName})</td>
                <td className="border px-2 py-1">{req.supervisorApproval?.byName || "—"}</td>
                <td className="border px-2 py-1">{fmtDate(req.supervisorApproval?.at)}</td>
                <td className="border px-2 py-1">{req.supervisorApproval?.comment || req.supervisorApproval?.coverPerson || "—"}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">Recursos Humanos</td>
                <td className="border px-2 py-1">{req.rrhhApproval?.byName || "—"}</td>
                <td className="border px-2 py-1">{fmtDate(req.rrhhApproval?.at)}</td>
                <td className="border px-2 py-1">{req.rrhhApproval?.comment || "—"}</td>
              </tr>
              {req.gerenciaApproval && (
                <tr>
                  <td className="border px-2 py-1">Gerencia General</td>
                  <td className="border px-2 py-1">{req.gerenciaApproval.byName}</td>
                  <td className="border px-2 py-1">{fmtDate(req.gerenciaApproval.at)}</td>
                  <td className="border px-2 py-1">{req.gerenciaApproval.comment || "—"}</td>
                </tr>
              )}
              {req.rejectionReason && (
                <tr className="bg-red-50">
                  <td className="border px-2 py-1 font-bold">Rechazo</td>
                  <td className="border px-2 py-1">{req.rejectedBy || "—"}</td>
                  <td className="border px-2 py-1">{fmtDate(req.rejectedAt)}</td>
                  <td className="border px-2 py-1">{req.rejectionReason}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="grid grid-cols-3 gap-8 mt-16 text-xs">
          <div className="text-center">
            <div className="border-t border-foreground pt-1">Solicitante</div>
            <p className="mt-1">{req.requestedByName}</p>
          </div>
          <div className="text-center">
            <div className="border-t border-foreground pt-1">Supervisor</div>
            <p className="mt-1">{req.supervisorApproval?.byName || req.supervisorName}</p>
          </div>
          <div className="text-center">
            <div className="border-t border-foreground pt-1">Recursos Humanos</div>
            <p className="mt-1">{req.rrhhApproval?.byName || "—"}</p>
          </div>
        </section>

        <footer className="mt-12 pt-4 border-t text-[10px] text-muted-foreground text-center">
          Documento generado electrónicamente por la Intranet SafeOne · Folio {req.id} ·
          Estado actual: <strong>{req.status}</strong>
        </footer>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default HRApprovalPrint;
