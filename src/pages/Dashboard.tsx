import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const mockDocuments: Document[] = [
  {
    id: "1",
    name: "Contrato de Prestação de Serviços - Cliente A",
    createdAt: "15/11/2025",
    status: "in_progress",
    signers: 3,
    signedBy: 1,
    signerStatuses: ["signed", "pending", "pending"],
  },
  {
    id: "2",
    name: "Termo de Confidencialidade - Parceiro B",
    createdAt: "14/11/2025",
    status: "signed",
    signers: 2,
    signedBy: 2,
    signerStatuses: ["signed", "signed"],
  },
  {
    id: "3",
    name: "Proposta Comercial - Projeto XYZ",
    createdAt: "13/11/2025",
    status: "pending",
    signers: 4,
    signedBy: 0,
    signerStatuses: ["pending", "pending", "pending", "pending"],
  },
  {
    id: "4",
    name: "Aditivo Contratual - Fornecedor C",
    createdAt: "12/11/2025",
    status: "in_progress",
    signers: 2,
    signedBy: 1,
    signerStatuses: ["signed", "pending"],
  },
  {
    id: "5",
    name: "Acordo de Parceria Estratégica",
    createdAt: "10/11/2025",
    status: "expired",
    signers: 3,
    signedBy: 2,
    signerStatuses: ["signed", "signed", "rejected"],
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  
  const currentDate = new Date();
  const weekDay = currentDate.toLocaleDateString('pt-BR', { weekday: 'long' });
  const date = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const subtitle = `${weekDay.charAt(0).toUpperCase() + weekDay.slice(1)}, ${date}`;

  return (
    <Layout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-600">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-1">
              {subtitle}
            </p>
          </div>
          <Button 
            onClick={() => navigate("/novo-documento")}
            className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90 shadow-lg"
          >
            <Upload className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Documento</span>
          </Button>
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
