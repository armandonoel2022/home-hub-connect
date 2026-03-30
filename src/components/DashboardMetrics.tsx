import { useEffect, useState } from "react";
import { isApiConfigured, ticketsApi, purchaseRequestsApi, hiringRequestsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, ShoppingCart, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface MetricData {
  ticketsOpen: number;
  ticketsTotal: number;
  purchasesPending: number;
  purchasesTotal: number;
  hiringPending: number;
  hiringTotal: number;
}

const DashboardMetrics = () => {
  const { user } = useAuth();
  const apiMode = isApiConfigured();
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiMode) { setLoading(false); return; }

    Promise.all([
      ticketsApi.getAll().catch(() => []),
      purchaseRequestsApi.getAll().catch(() => []),
      hiringRequestsApi.getAll().catch(() => []),
    ]).then(([tickets, purchases, hiring]) => {
      setMetrics({
        ticketsOpen: tickets.filter((t: any) => t.status === "Abierto" || t.status === "En Progreso").length,
        ticketsTotal: tickets.length,
        purchasesPending: purchases.filter((p: any) => p.status === "Pendiente" || p.status === "pending").length,
        purchasesTotal: purchases.length,
        hiringPending: hiring.filter((h: any) => h.status === "Pendiente" || h.status === "pending").length,
        hiringTotal: hiring.length,
      });
    }).finally(() => setLoading(false));
  }, [apiMode]);

  if (!apiMode || loading || !metrics) return null;

  const cards = [
    {
      label: "Tickets Abiertos",
      value: metrics.ticketsOpen,
      total: metrics.ticketsTotal,
      icon: Ticket,
      color: metrics.ticketsOpen > 5 ? "text-destructive" : "text-primary",
    },
    {
      label: "Compras Pendientes",
      value: metrics.purchasesPending,
      total: metrics.purchasesTotal,
      icon: ShoppingCart,
      color: metrics.purchasesPending > 3 ? "text-orange-500" : "text-primary",
    },
    {
      label: "Contrataciones Pendientes",
      value: metrics.hiringPending,
      total: metrics.hiringTotal,
      icon: Users,
      color: metrics.hiringPending > 0 ? "text-blue-500" : "text-primary",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
          <Card key={card.label} className="border-none shadow-sm">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className={`p-2 rounded-lg bg-muted`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className={`text-xl font-heading font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label} <span className="opacity-60">/ {card.total} total</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default DashboardMetrics;
