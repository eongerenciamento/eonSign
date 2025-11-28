import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, FileCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Reports = () => {
  return (
    <Layout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-600">Relatórios</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select defaultValue="30">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="hr">Recursos Humanos</SelectItem>
              <SelectItem value="legal">Jurídico</SelectItem>
              <SelectItem value="sales">Vendas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                <p className="text-2xl font-bold">87.5%</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <FileCheck className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Docs Assinados</p>
                <p className="text-2xl font-bold">98</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold">2.3d</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Signatários Ativos</p>
                <p className="text-2xl font-bold">234</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Documentos por Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-700 text-white hover:bg-green-700">Assinados</Badge>
                </div>
                <span className="text-sm text-muted-foreground">62.8%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-700 text-white hover:bg-yellow-700">Em Andamento</Badge>
                </div>
                <span className="text-sm text-muted-foreground">28.8%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-700 text-white hover:bg-red-700">Expirados</Badge>
                </div>
                <span className="text-sm text-muted-foreground">8.4%</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Signatários</h3>
            <div className="space-y-4">
              {[
                { name: "João Silva", docs: 24, email: "joao.silva@empresa.com" },
                { name: "Maria Santos", docs: 19, email: "maria.santos@empresa.com" },
                { name: "Pedro Costa", docs: 15, email: "pedro.costa@empresa.com" },
                { name: "Ana Oliveira", docs: 12, email: "ana.oliveira@empresa.com" },
              ].map((signer) => (
                <div key={signer.email} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{signer.name}</p>
                    <p className="text-sm text-muted-foreground">{signer.email}</p>
                  </div>
                  <Badge variant="secondary">{signer.docs} docs</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
          <div className="space-y-4">
            {[
              { action: "Documento assinado", doc: "Contrato - Cliente A", time: "Há 2 horas", status: "success" },
              { action: "Documento enviado", doc: "Proposta Comercial", time: "Há 5 horas", status: "default" },
              { action: "Documento assinado", doc: "NDA - Parceiro B", time: "Há 1 dia", status: "success" },
              { action: "Documento expirado", doc: "Termo de Adesão", time: "Há 2 dias", status: "warning" },
            ].map((activity, index) => (
              <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.status === "success" ? "bg-success" :
                  activity.status === "warning" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex-1">
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.doc}</p>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;
