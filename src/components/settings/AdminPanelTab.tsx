import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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

// Mock data for MRR evolution chart
const mrrEvolutionData = [
  { month: "Jul", mrr: 12500, arr: 150000 },
  { month: "Ago", mrr: 14200, arr: 170400 },
  { month: "Set", mrr: 15800, arr: 189600 },
  { month: "Out", mrr: 17500, arr: 210000 },
  { month: "Nov", mrr: 19200, arr: 230400 },
  { month: "Dez", mrr: 21000, arr: 252000 },
];

// Colors for pie chart
const PLAN_COLORS = ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

// Mock data for organizations chart
const topOrganizationsData = [
  { name: "Org A", members: 45, percentage: 18 },
  { name: "Org B", members: 38, percentage: 15 },
  { name: "Org C", members: 32, percentage: 13 },
  { name: "Org D", members: 28, percentage: 11 },
  { name: "Org E", members: 22, percentage: 9 },
];

export const AdminPanelTab = () => {
  const [showARR, setShowARR] = useState(false);

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-get-metrics");
      if (error) throw error;
      return data as Metrics;
    },
    refetchInterval: 60000,
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

  // Prepare pie chart data from subscriptionsByPlan
  const planDistributionData = metrics?.subscriptionsByPlan
    ? Object.entries(metrics.subscriptionsByPlan).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const statCards = [
    {
      title: "Novos Clientes",
      value: metrics?.totalUsers || 0,
    },
    {
      title: "Organizações Ativas",
      value: metrics?.organizations || 0,
    },
    {
      title: "Usuários do Sistema",
      value: metrics?.totalUsers || 0,
    },
    {
      title: "Colaboradores Ativos",
      value: metrics?.activeSubscriptions || 0,
    },
    {
      title: "MRR",
      value: `R$ ${(metrics?.monthlyRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    },
    {
      title: "Receita do Mês",
      value: `R$ ${(metrics?.monthlyRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    },
    {
      title: "Reembolsos",
      value: "R$ 0,00",
    },
    {
      title: "Cancelamentos",
      value: 0,
    },
  ];

  // Subscription summary data
  const subscriptionSummary = [
    {
      label: "Ativas",
      value: metrics?.activeSubscriptions || 0,
      color: "bg-blue-600",
      max: (metrics?.totalUsers || 1),
    },
    {
      label: "Canceladas",
      value: 0,
      color: "bg-gray-400",
      max: (metrics?.totalUsers || 1),
    },
    {
      label: "Total Clientes",
      value: metrics?.totalUsers || 0,
      color: "bg-gray-400",
      max: (metrics?.totalUsers || 1),
    },
    {
      label: "Planos Únicos",
      value: Object.keys(metrics?.subscriptionsByPlan || {}).length,
      color: "bg-gray-400",
      max: 10,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats Grid - 2 columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, index) => (
          <Card key={index} className="bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{stat.title}</p>
              <p className="text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-400">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscription Summary */}
      <Card className="bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-foreground">Resumo de Assinaturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {subscriptionSummary.map((item, index) => (
              <div key={index} className="space-y-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{item.value}</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full transition-all`}
                    style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MRR Evolution Chart */}
        <Card className="bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-foreground">Evolução MRR</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="arr-toggle" className="text-xs text-muted-foreground">MRR</Label>
                <Switch
                  id="arr-toggle"
                  checked={showARR}
                  onCheckedChange={setShowARR}
                />
                <Label htmlFor="arr-toggle" className="text-xs text-muted-foreground">ARR</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrEvolutionData}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, showARR ? "ARR" : "MRR"]}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      border: 'none', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={showARR ? "arr" : "mrr"}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMrr)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution Chart */}
        <Card className="bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-foreground">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {planDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {planDistributionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} assinaturas`, name]}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255,255,255,0.95)', 
                        border: 'none', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhum dado de planos disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Chart */}
      <Card className="bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-foreground">Organizações com mais Colaboradores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topOrganizationsData} barCategoryGap="20%">
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} colaboradores`, 'Membros']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.95)', 
                    border: 'none', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar 
                  dataKey="members" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  label={{ 
                    position: 'top', 
                    formatter: (value: number) => `${topOrganizationsData.find(d => d.members === value)?.percentage || 0}%`,
                    fontSize: 10,
                    fill: '#6b7280'
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions by Plan - Legacy section updated */}
      <Card className="bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-foreground">Assinaturas por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics?.subscriptionsByPlan && Object.entries(metrics.subscriptionsByPlan).length > 0 ? (
              Object.entries(metrics.subscriptionsByPlan).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="font-medium text-foreground">{plan}</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{count}</span>
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
