import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, FolderPlus, LayoutGrid, List, Folder as FolderIcon, Filter, CalendarIcon } from "lucide-react";
import { CreateFolderDialog } from "@/components/documents/CreateFolderDialog";
import { FoldersList, Folder } from "@/components/documents/FoldersList";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const allDocuments: Document[] = [
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
    id: "6",
    name: "Contrato de Trabalho - Colaborador D",
    createdAt: "09/11/2025",
    status: "signed",
    signers: 2,
    signedBy: 2,
    signerStatuses: ["signed", "signed"],
    signerNames: ["Empresa Admin", "Roberto Costa"],
    folderId: null,
  },
];

const Drive = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>(allDocuments);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>(allDocuments);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const { toast } = useToast();

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [searchQuery, sortBy, documents, selectedFolder, dateFrom, dateTo]);

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

    // Filter out documents that are in folders (only show unassigned documents)
    if (!selectedFolder) {
      filtered = filtered.filter((doc) => !doc.folderId);
    } else {
      // Filter by selected folder
      filtered = filtered.filter((doc) => doc.folderId === selectedFolder);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter((doc) => {
        const docDate = new Date(doc.createdAt.split('/').reverse().join('-'));
        return docDate >= dateFrom;
      });
    }

    if (dateTo) {
      filtered = filtered.filter((doc) => {
        const docDate = new Date(doc.createdAt.split('/').reverse().join('-'));
        return docDate <= dateTo;
      });
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

  const handleAdvancedFilters = (filters: any) => {
    if (filters.dateFrom) {
      setDateFrom(filters.dateFrom);
    }
    if (filters.dateTo) {
      setDateTo(filters.dateTo);
    }
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
                <h1 className="text-sm font-bold text-gray-600">
                  {folders.find((f) => f.id === selectedFolder)?.name}
                </h1>
              </div>
            ) : (
              <h1 className="text-sm font-bold text-gray-600">Éon Drive</h1>
            )}
          </div>
          <CreateFolderDialog onFolderCreated={loadFolders} />
        </div>

        {/* Folders Section */}
        {!selectedFolder && folders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm text-gray-600">Pastas</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="hover:bg-transparent active:bg-transparent focus:bg-transparent h-auto w-auto p-0"
              >
                {viewMode === "grid" ? (
                  <List className="w-5 h-5 text-gray-600" />
                ) : (
                  <LayoutGrid className="w-5 h-5 text-gray-600" />
                )}
              </Button>
            </div>
            <FoldersList
              folders={folders}
              documents={documents}
              viewMode={viewMode}
              onFolderClick={setSelectedFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          </div>
        )}

        {/* Unallocated Documents Section */}
        {!selectedFolder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm text-gray-600">Documentos Não Alocados</h2>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-transparent w-8 h-8 p-0"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 text-gray-600" />
              </Button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="flex flex-col gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar documentos..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Mais Recentes</SelectItem>
                      <SelectItem value="oldest">Mais Antigos</SelectItem>
                      <SelectItem value="name">Nome A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Documents Table */}
            <DocumentsTable documents={filteredDocuments} showProgress={false} folders={folders} />
          </div>
        )}

        {/* Selected Folder Documents */}
        {selectedFolder && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documentos..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais Recentes</SelectItem>
                    <SelectItem value="oldest">Mais Antigos</SelectItem>
                    <SelectItem value="name">Nome A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DocumentsTable documents={filteredDocuments} showProgress={false} folders={folders} />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Drive;
