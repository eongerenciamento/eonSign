import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { UploadDialog } from "@/components/documents/UploadDialog";

const mockDocuments: Document[] = [
  {
    id: "1",
    name: "Contrato de Prestação de Serviços - Cliente A",
    createdAt: "15/11/2025",
    status: "in_progress",
    signers: 3,
    signedBy: 1,
  },
  {
    id: "2",
    name: "Termo de Confidencialidade - Parceiro B",
    createdAt: "14/11/2025",
    status: "signed",
    signers: 2,
    signedBy: 2,
  },
  {
    id: "3",
    name: "Proposta Comercial - Projeto XYZ",
    createdAt: "13/11/2025",
    status: "pending",
    signers: 4,
    signedBy: 0,
  },
  {
    id: "4",
    name: "Aditivo Contratual - Fornecedor C",
    createdAt: "12/11/2025",
    status: "in_progress",
    signers: 2,
    signedBy: 1,
  },
  {
    id: "5",
    name: "Acordo de Parceria Estratégica",
    createdAt: "10/11/2025",
    status: "expired",
    signers: 3,
    signedBy: 2,
  },
];

const Dashboard = () => {
  return (
    <Layout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral das suas assinaturas digitais
            </p>
          </div>
          <UploadDialog />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total de Documentos"
            value={156}
            icon={FileText}
            variant="primary"
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Assinados"
            value={98}
            icon={CheckCircle}
            variant="success"
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Aguardando"
            value={45}
            icon={Clock}
            variant="warning"
            trend={{ value: -5, isPositive: false }}
          />
          <StatsCard
            title="Expirados"
            value={13}
            icon={AlertCircle}
            variant="default"
          />
        </div>

        {/* Recent Documents */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Documentos Recentes
            </h2>
          </div>
          <DocumentsTable documents={mockDocuments} />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
