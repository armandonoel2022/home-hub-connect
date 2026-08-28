import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fixedAssetsSqlApi, type AssetLookupResult } from "@/lib/api";
import logo from "@/assets/safeone-logo.png";
import { Loader2, PackageSearch, AlertTriangle, ArrowLeft } from "lucide-react";

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-border/60 last:border-0">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-right break-words">{value || "—"}</span>
  </div>
);

/** Ficha pública-interna de un activo fijo, abierta al escanear el QR de la etiqueta. */
const AssetLookup = () => {
  const { code = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AssetLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/activo/${code}`)}`, { replace: true });
      return;
    }
    let alive = true;
    setLoading(true);
    fixedAssetsSqlApi
      .lookup(code)
      .then((r) => alive && (setData(r), setError("")))
      .catch((e: any) => alive && setError(e?.message || "No se pudo consultar el activo"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [code, user, authLoading, navigate]);

  const a = data?.asset;
  const money = (n?: number | null) =>
    typeof n === "number" ? n.toLocaleString("es-DO", { style: "currency", currency: "DOP" }) : "—";
  const date = (d?: string | null) => (d ? new Date(d).toLocaleDateString("es-DO") : "—");

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <img src={logo} alt="SafeOne" className="h-9 w-auto" />
          <div>
            <h1 className="font-heading font-bold text-lg leading-none">Consulta de Activo Fijo</h1>
            <p className="text-xs text-muted-foreground mt-1">Etiqueta escaneada: {code}</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Consultando la base SafeOne…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border bg-card p-5 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
            <p className="font-semibold">No se encontró información</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        {!loading && a && (
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="bg-secondary text-secondary-foreground px-4 py-3">
              <div className="flex items-center gap-2 text-xs opacity-80">
                <PackageSearch className="h-4 w-4" /> {a.TipoNombre || a.CategoriaNombre || "Activo Fijo"}
              </div>
              <div className="font-heading font-bold text-xl mt-1">{a.CodigoBarra || `AF-${a.OID}`}</div>
              <div className="text-sm opacity-90">{a.Descripcion || "—"}</div>
            </div>
            <div className="p-4">
              <Row label="Categoría" value={a.CategoriaNombre} />
              <Row label="Tipo" value={a.TipoNombre} />
              <Row label="Marca / Suplidor" value={a.SuplidorNombre} />
              <Row label="Modelo" value={a.Modelo} />
              <Row label="Serie" value={a.Serial} />
              <Row label="Asignado a" value={a.Encargado} />
              <Row label="Departamento" value={a.Departamento} />
              <Row label="Ubicación" value={a.Ubicacion} />
              <Row label="Estado" value={a.Retirado ? "Retirado" : a.Transito ? "En tránsito" : "Activo"} />
              <Row label="Costo de adquisición" value={money(a.CostoAdq)} />
              <Row label="Fecha de adquisición" value={date(a.FechaAdq)} />
              {a.Comentario && <Row label="Comentario" value={a.Comentario} />}
            </div>
          </div>
        )}

        <Link
          to="/admin/hub"
          className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Ir al Hub de Administración
        </Link>
      </div>
    </div>
  );
};

export default AssetLookup;
