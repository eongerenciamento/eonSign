import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { UploadDialog } from "@/components/documents/UploadDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft } from "lucide-react";
import { CreateFolderDialog } from "@/components/documents/CreateFolderDialog";
import { AdvancedFiltersDialog, AdvancedFilters } from "@/components/documents/AdvancedFiltersDialog";
import { FoldersList, Folder } from "@/components/documents/FoldersList";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>(allDocuments);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>(allDocuments);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const { toast } = useToast();

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [searchQuery, statusFilter, sortBy, documents, selectedFolder]);

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar pastas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setFolders(data || []);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    // Filter by folder
    if (selectedFolder) {
      filtered = filtered.filter((doc) => doc.id === selectedFolder);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((doc) => doc.status === statusFilter);
    }

    // Sort
    if (sortBy === "recent") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    setFilteredDocuments(filtered);
  };

  const handleAdvancedFilters = (filters: AdvancedFilters) => {
    let filtered = [...documents];

    if (filters.status !== "all") {
      filtered = filtered.filter((doc) => doc.status === filters.status);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(
        (doc) => new Date(doc.createdAt) >= filters.dateFrom!
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(
        (doc) => new Date(doc.createdAt) <= filters.dateTo!
      );
    }

    if (filters.signers && filters.signers !== "all") {
      const signersNum = filters.signers === "4+" ? 4 : parseInt(filters.signers);
      if (filters.signers === "4+") {
        filtered = filtered.filter((doc) => doc.signers >= signersNum);
      } else {
        filtered = filtered.filter((doc) => doc.signers === signersNum);
      }
    }

    setFilteredDocuments(filtered);
  };

  const handleDeleteFolder = async (folderId: string) => {
    const { error } = await supabase.from("folders").delete().eq("id", folderId);

    if (error) {
      toast({
        title: "Erro ao excluir pasta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pasta excluída",
        description: "A pasta foi excluída com sucesso.",
      });
      loadFolders();
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
    }
  };

  const handleRenameFolder = async (folder: Folder) => {
    const newName = prompt("Novo nome da pasta:", folder.name);
    if (!newName || newName === folder.name) return;

    const { error } = await supabase
      .from("folders")
      .update({ name: newName })
      .eq("id", folder.id);

    if (error) {
      toast({
        title: "Erro ao renomear pasta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pasta renomeada",
        description: "A pasta foi renomeada com sucesso.",
      });
      loadFolders();
    }
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            {selectedFolder ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFolder(null)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    {folders.find((f) => f.id === selectedFolder)?.name}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Documentos da pasta
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie todos os seus documentos e assinaturas
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!selectedFolder && <CreateFolderDialog onFolderCreated={loadFolders} />}
            <UploadDialog />
          </div>
        </div>

        {/* Folders Section */}
        {!selectedFolder && folders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Pastas</h2>
            <FoldersList
              folders={folders}
              onFolderClick={setSelectedFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documentos..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais Recentes</SelectItem>
              <SelectItem value="oldest">Mais Antigos</SelectItem>
              <SelectItem value="name">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
          <AdvancedFiltersDialog onApplyFilters={handleAdvancedFilters} />
        </div>

        {/* Documents Table */}
        <DocumentsTable documents={filteredDocuments} />
      </div>
    </Layout>
  );
};

export default Documents;
