import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { UploadDialog } from "@/components/documents/UploadDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const allDocuments: Document[] = [
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
  {
    id: "6",
    name: "Contrato de Trabalho - Colaborador D",
    createdAt: "09/11/2025",
    status: "signed",
    signers: 2,
    signedBy: 2,
  },
  {
    id: "7",
    name: "Termo de Adesão - Serviço Premium",
    createdAt: "08/11/2025",
    status: "in_progress",
    signers: 1,
    signedBy: 0,
  },
  {
    id: "8",
    name: "NDA - Projeto Confidencial Alpha",
    createdAt: "07/11/2025",
    status: "pending",
    signers: 5,
    signedBy: 0,
  },
];

const Documents = () => {
  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os seus documentos e assinaturas
            </p>
          </div>
          <UploadDialog />
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documentos..."
              className="pl-10"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="signed">Assinado</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="recent">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais Recentes</SelectItem>
              <SelectItem value="oldest">Mais Antigos</SelectItem>
              <SelectItem value="name">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Documents Table */}
        <DocumentsTable documents={allDocuments} />
      </div>
    </Layout>
  );
};

export default Documents;
