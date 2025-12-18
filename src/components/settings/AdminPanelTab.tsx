import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Building2, FileText, CreditCard, Ticket, DollarSign, TrendingUp, FileCheck } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Metrics {
  totalUsers: number;
  organizations: number;
  activeSubscriptions: number;
  subscriptionsByPlan: Record<string, number>;
  totalDocuments: number;
  signedDocuments: number;
  documentsThisMonth: number;
  totalTickets: number;
  openTickets: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

export const AdminPanelTab = () => {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-get-metrics");
      if (error) throw error;
      return data as Metrics;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        Erro ao carregar métricas: {(error as Error).message}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total de Usuários",
      value: metrics?.totalUsers || 0,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      title: "Organizações",
      value: metrics?.organizations || 0,
      icon: Building2,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
    {
      title: "Assinaturas Ativas",
      value: metrics?.activeSubscriptions || 0,
      icon: CreditCard,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
    },
    {
      title: "Documentos Total",
      value: metrics?.totalDocuments || 0,
      icon: FileText,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
    },
    {
      title: "Documentos Assinados",
      value: metrics?.signedDocuments || 0,
      icon: FileCheck,
      color: "text-teal-400",
      bgColor: "bg-teal-500/20",
    },
    {
      title: "Documentos Este Mês",
      value: metrics?.documentsThisMonth || 0,
      icon: TrendingUp,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/20",
    },
    {
      title: "Tickets Abertos",
      value: metrics?.openTickets || 0,
      subtitle: `de ${metrics?.totalTickets || 0} total`,
      icon: Ticket,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
    },
    {
      title: "Receita Total",
      value: `R$ ${(metrics?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      title: "Receita Mensal",
      value: `R$ ${(metrics?.monthlyRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="bg-card shadow-md border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscriptions by Plan */}
      <Card className="bg-card shadow-md border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">Assinaturas por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics?.subscriptionsByPlan && Object.entries(metrics.subscriptionsByPlan).length > 0 ? (
              Object.entries(metrics.subscriptionsByPlan).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="font-medium text-foreground">{plan}</span>
                  <span className="text-lg font-bold text-foreground">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">Nenhuma assinatura ativa</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};