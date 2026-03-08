import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import {
  FolderOpen,
  FileText,
  Upload,
  ChevronRight,
  ChevronDown,
  X,
  File,
  Download,
  Trash2,
  Plus,
  Shield,
} from "lucide-react";

interface BASCDocument {
  id: string;
  name: string;
  type: "pdf" | "word" | "excel" | "other";
  category: string;
  department: string;
  uploadedBy: string;
  uploadedAt: string;
  size: string;
}

const BASC_CATEGORIES = [
  "Procedimientos",
  "Formularios",
  "Matriz de Riesgos",
  "Políticas",
  "Registros",
  "Manuales",
  "Auditorías",
];

const fileTypeIcons: Record<string, string> = {
  pdf: "📄",
  word: "📝",
  excel: "📊",
  other: "📎",
};

const fileTypeColors: Record<string, string> = {
  pdf: "bg-red-50 text-red-700",
  word: "bg-blue-50 text-blue-700",
  excel: "bg-emerald-50 text-emerald-700",
  other: "bg-gray-100 text-gray-600",
};

// Mock documents
const initialDocs: BASCDocument[] = [
  { id: "DOC-001", name: "Procedimiento de Control de Acceso.pdf", type: "pdf", category: "Procedimientos", department: "Operaciones", uploadedBy: "Anoel", uploadedAt: "2026-02-15", size: "2.4 MB" },
  { id: "DOC-002", name: "Formulario de Inspección Vehicular.pdf", type: "pdf", category: "Formularios", department: "Operaciones", uploadedBy: "Remit", uploadedAt: "2026-02-20", size: "1.1 MB" },
  { id: "DOC-003", name: "Matriz de Riesgos General.xlsx", type: "excel", category: "Matriz de Riesgos", department: "Administración", uploadedBy: "Anoel", uploadedAt: "2026-03-01", size: "890 KB" },
  { id: "DOC-004", name: "Política de Seguridad Física.pdf", type: "pdf", category: "Políticas", department: "Gerencia General", uploadedBy: "Anoel", uploadedAt: "2026-01-10", size: "3.2 MB" },
  { id: "DOC-005", name: "Registro de Capacitaciones.docx", type: "word", category: "Registros", department: "Administración", uploadedBy: "Anoel", uploadedAt: "2026-02-28", size: "560 KB" },
  { id: "DOC-006", name: "Procedimiento de Manejo de Armas.pdf", type: "pdf", category: "Procedimientos", department: "Operaciones", uploadedBy: "Remit", uploadedAt: "2026-03-03", size: "1.8 MB" },
];

const BASCPage = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<BASCDocument[]>(initialDocs);
  const [expandedDept, setExpandedDept] = useState<string | null>(user?.department || "Operaciones");
  const [expandedCat, setExpandedCat] = useState<string | null>("Procedimientos");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ department: user?.department || "", category: "", file: null as File | null });
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // Non-admins only see their department's documents
  const accessibleDocs = user?.isAdmin
    ? documents
    : documents.filter((d) => d.department === user?.department);

  const filteredDocs = accessibleDocs.filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchDept = !filterDept || d.department === filterDept;
    return matchSearch && matchDept;
  });

  // Group by department then category
  const grouped: Record<string, Record<string, BASCDocument[]>> = {};
  filteredDocs.forEach((d) => {
    if (!grouped[d.department]) grouped[d.department] = {};
    if (!grouped[d.department][d.category]) grouped[d.department][d.category] = [];
    grouped[d.department][d.category].push(d);
  });

  const handleUpload = () => {
    if (!uploadForm.file || !uploadForm.department || !uploadForm.category) return;
    const ext = uploadForm.file.name.split(".").pop()?.toLowerCase();
    let type: BASCDocument["type"] = "other";
    if (ext === "pdf") type = "pdf";
    else if (ext === "doc" || ext === "docx") type = "word";
    else if (ext === "xls" || ext === "xlsx") type = "excel";

    const newDoc: BASCDocument = {
      id: `DOC-${String(documents.length + 1).padStart(3, "0")}`,
      name: uploadForm.file.name,
      type,
      category: uploadForm.category,
      department: uploadForm.department,
      uploadedBy: "Usuario Actual",
      uploadedAt: new Date().toISOString().split("T")[0],
      size: `${(uploadForm.file.size / 1024).toFixed(0)} KB`,
    };
    setDocuments([newDoc, ...documents]);
    setShowUpload(false);
    setUploadForm({ department: "", category: "", file: null });
  };

  const handleDelete = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
  };

  const getFileExtension = (name: string) => name.split(".").pop()?.toUpperCase() || "";

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    <span className="gold-accent-text">BASC</span> — Gestión Documental
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    Business Alliance for Secure Commerce — Procedimientos, Formularios y Control Documental
                  </p>
                </div>
              </div>
              <button onClick={() => setShowUpload(true)} className="btn-gold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Subir Documento
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 flex flex-wrap gap-4">
          <div className="relative flex-1 max-w-md">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
          >
            <option value="">Todos los departamentos</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Documentos", value: documents.length, color: "text-card-foreground" },
            { label: "Procedimientos", value: documents.filter((d) => d.category === "Procedimientos").length, color: "gold-accent-text" },
            { label: "Formularios", value: documents.filter((d) => d.category === "Formularios").length, color: "gold-accent-text" },
            { label: "Departamentos", value: new Set(documents.map((d) => d.department)).size, color: "text-card-foreground" },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-heading font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Folder tree */}
        <div className="px-6 pb-8">
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No se encontraron documentos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([dept, cats]) => (
                <div key={dept} className="bg-card rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedDept(expandedDept === dept ? null : dept)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    {expandedDept === dept ? (
                      <ChevronDown className="h-4 w-4 text-gold shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <FolderOpen className="h-5 w-5 text-gold shrink-0" />
                    <span className="font-heading font-bold text-card-foreground">{dept}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Object.values(cats).flat().length} documentos
                    </span>
                  </button>
                  {expandedDept === dept && (
                    <div className="border-t border-border">
                      {Object.entries(cats).sort(([a], [b]) => a.localeCompare(b)).map(([cat, docs]) => (
                        <div key={cat}>
                          <button
                            onClick={() => setExpandedCat(expandedCat === `${dept}-${cat}` ? null : `${dept}-${cat}`)}
                            className="w-full flex items-center gap-3 pl-12 pr-5 py-3 text-left hover:bg-muted/30 transition-colors"
                          >
                            {expandedCat === `${dept}-${cat}` ? (
                              <ChevronDown className="h-3 w-3 text-gold shrink-0" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium text-card-foreground">{cat}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{docs.length}</span>
                          </button>
                          {expandedCat === `${dept}-${cat}` && (
                            <div className="pl-20 pr-5 pb-3 space-y-2">
                              {docs.map((doc) => (
                                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${fileTypeColors[doc.type]}`}>
                                    {getFileExtension(doc.name)}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-card-foreground truncate">{doc.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {doc.uploadedBy} · {doc.uploadedAt} · {doc.size}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-card-foreground transition-colors" title="Descargar">
                                      <Download className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Subir Documento</h2>
                <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento *</label>
                  <select
                    value={uploadForm.department}
                    onChange={(e) => setUploadForm({ ...uploadForm, department: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Categoría *</label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {BASC_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Archivo *</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    {uploadForm.file ? (
                      <div className="flex items-center justify-center gap-2">
                        <File className="h-5 w-5 text-gold" />
                        <span className="text-sm text-card-foreground font-medium">{uploadForm.file.name}</span>
                        <button onClick={() => setUploadForm({ ...uploadForm, file: null })} className="p-1 hover:bg-muted rounded">
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">PDF, Word o Excel</p>
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium text-card-foreground cursor-pointer hover:bg-border transition-colors">
                          <Plus className="h-4 w-4" />
                          Seleccionar archivo
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setUploadForm({ ...uploadForm, file });
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowUpload(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={handleUpload} className="btn-gold text-sm">Subir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BASCPage;
