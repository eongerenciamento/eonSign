import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    signerNames: ["Empresa Admin", "João Silva", "Maria Santos"],
    folderId: null,
  },
  {
    id: "2",
    name: "Termo de Confidencialidade - Parceiro B",
    createdAt: "14/11/2025",
    status: "signed",
    signers: 2,
    signedBy: 2,
    signerStatuses: ["signed", "signed"],
    signerNames: ["Empresa Admin", "Carlos Oliveira"],
    folderId: null,
  },
  {
    id: "3",
    name: "Proposta Comercial - Projeto XYZ",
    createdAt: "13/11/2025",
    status: "pending",
    signers: 4,
    signedBy: 0,
    signerStatuses: ["pending", "pending", "pending", "pending"],
    signerNames: ["Empresa Admin", "Ana Costa", "Pedro Alves", "Lucas Mendes"],
    folderId: null,
  },
  {
    id: "4",
    name: "Aditivo Contratual - Fornecedor C",
    createdAt: "12/11/2025",
    status: "in_progress",
    signers: 2,
    signedBy: 1,
    signerStatuses: ["signed", "pending"],
    signerNames: ["Empresa Admin", "Fernanda Lima"],
    folderId: null,
  },
  {
    id: "5",
    name: "Acordo de Parceria Estratégica",
    createdAt: "10/11/2025",
    status: "expired",
    signers: 3,
    signedBy: 2,
    signerStatuses: ["signed", "signed", "rejected"],
    signerNames: ["Empresa Admin", "Rafael Souza", "Juliana Rocha"],
    folderId: null,
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  
  const currentDate = new Date();
  const weekDay = currentDate.toLocaleDateString('pt-BR', { weekday: 'long' });
  const date = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const subtitle = `${weekDay.charAt(0).toUpperCase() + weekDay.slice(1)}, ${date}`;

  // Calculate pending documents
  const pendingByOwner = mockDocuments.filter(doc => 
    doc.signerStatuses && doc.signerStatuses[0] === "pending"
  ).length;
  
  const pendingByExternal = mockDocuments.filter(doc => 
    doc.signerStatuses && doc.signerStatuses.slice(1).some(status => status === "pending")
  ).length;

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
            className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90 shadow-lg rounded-full w-12 h-12 p-0 md:w-auto md:h-auto md:rounded-md md:px-4 md:py-2"
          >
            <Upload className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">Documento</span>
          </Button>
        </div>

        {/* Pending Documents Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card 
            className="bg-gradient-to-r from-[#273d60] to-[#001f3f] border-none cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => navigate("/documentos?tab=pending_internal")}
          >
            <CardHeader className="pb-2 px-6">
              <CardTitle className="text-white text-base">
                Pendentes
              </CardTitle>
              <p className="text-gray-200 text-xs">Sua Assinatura</p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <p className="text-3xl font-bold text-white">{pendingByOwner}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-r from-[#273d60] to-[#001f3f] border-none cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => navigate("/documentos?tab=pending_external")}
          >
            <CardHeader className="pb-2 px-6">
              <CardTitle className="text-white text-base">
                Pendentes
              </CardTitle>
              <p className="text-gray-200 text-xs">Signatários Externos</p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <p className="text-3xl font-bold text-white">{pendingByExternal}</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Documentos Recentes
            </h2>
          </div>
          <DocumentsTable documents={mockDocuments} showFolderActions={false} />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
