import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, LayoutGrid, List, Folder as FolderIcon, Filter, CalendarIcon, Plus, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { FoldersList, Folder } from "@/components/documents/FoldersList";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const Drive = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [showFolderFilters, setShowFolderFilters] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFolders();
    loadAllFolders();
  }, [selectedFolder]);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [searchQuery, sortBy, documents, selectedFolder, dateFrom, dateTo]);

  const loadDocuments = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("status", "signed");

    if (error) {
      toast({
        title: "Erro ao carregar documentos",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      const mappedDocs: Document[] = data.map(doc => ({
        id: doc.id,
        name: doc.name,
        createdAt: new Date(doc.created_at).toLocaleDateString('pt-BR'),
        status: doc.status as "pending" | "signed" | "expired" | "in_progress",
        signers: doc.signers,
        signedBy: doc.signed_by,
        folderId: doc.folder_id,
        signerStatuses: [],
        signerNames: [],
      }));
      setDocuments(mappedDocs);
    }
  };

  const loadFolders = async () => {
    let query = supabase
      .from("folders")
      .select("*")
      .order("name", { ascending: true });

    // Se não há pasta selecionada, carregar apenas pastas raiz
    if (!selectedFolder) {
      query = query.is("parent_folder_id", null);
    } else {
      // Se há pasta selecionada, carregar apenas subpastas dessa pasta
      query = query.eq("parent_folder_id", selectedFolder);
    }

    const { data, error } = await query;

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

  const loadAllFolders = async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Erro ao carregar todas as pastas:", error);
    } else {
      setAllFolders(data || []);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    // Filter by selected folder
    if (selectedFolder) {
      filtered = filtered.filter((doc) => doc.folderId === selectedFolder);
    } else {
      // No documents shown at root level - they're managed in Documents page
      filtered = [];
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

  const handleCreateFolderInline = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para criar pastas.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("folders")
      .insert({ name: "Nova Pasta", user_id: userData.user.id })
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao criar pasta",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setEditingFolderId(data.id);
      await loadFolders();
    }
  };

  const handleSaveFolderName = async (folderId: string, newName: string) => {
    if (!newName.trim()) {
      await handleCancelEdit(folderId);
      return;
    }

    const { error } = await supabase
      .from("folders")
      .update({ name: newName.trim() })
      .eq("id", folderId);

    if (error) {
      toast({
        title: "Erro ao salvar nome da pasta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEditingFolderId(null);
      await loadFolders();
    }
  };

  const handleCancelEdit = async (folderId: string) => {
    await supabase.from("folders").delete().eq("id", folderId);
    setEditingFolderId(null);
    await loadFolders();
  };

  const handleCreateSubfolder = async () => {
    if (!selectedFolder) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para criar pastas.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("folders")
      .insert({ name: "Nova Subpasta", user_id: userData.user.id, parent_folder_id: selectedFolder })
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao criar subpasta",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setEditingFolderId(data.id);
      await loadFolders();
    }
  };

  const handleDocumentMoved = () => {
    loadDocuments();
  };

  const handleMoveFolder = async (folderId: string, targetFolderId: string | null) => {
    // Validar que pasta não pode ser movida para si mesma
    if (folderId === targetFolderId) {
      toast({
        title: "Operação inválida",
        description: "Uma pasta não pode ser movida para si mesma.",
        variant: "destructive",
      });
      return;
    }

    // Validar que pasta não pode ser movida para uma de suas subpastas
    const isSubfolder = (parentId: string, childId: string | null): boolean => {
      if (!childId) return false;
      if (parentId === childId) return true;
      const folder = allFolders.find(f => f.id === childId);
      if (!folder || !folder.parent_folder_id) return false;
      return isSubfolder(parentId, folder.parent_folder_id);
    };

    if (targetFolderId && isSubfolder(folderId, targetFolderId)) {
      toast({
        title: "Operação inválida",
        description: "Uma pasta não pode ser movida para dentro de uma de suas subpastas.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("folders")
      .update({ parent_folder_id: targetFolderId })
      .eq("id", folderId);

    if (error) {
      toast({
        title: "Erro ao mover pasta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pasta movida",
        description: "A pasta foi movida com sucesso.",
      });
      loadFolders();
      loadAllFolders();
    }
  };

  const handleDropDocumentOnFolder = async (documentId: string, folderId: string) => {
    const { error } = await supabase
      .from("documents")
      .update({ folder_id: folderId })
      .eq("id", documentId);

    if (error) {
      toast({
        title: "Erro ao mover documento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Documento movido",
        description: "O documento foi movido com sucesso.",
      });
      loadDocuments();
    }
  };

  const getBreadcrumbPath = (): { id: string; name: string }[] => {
    if (!selectedFolder) return [];
    
    const path: { id: string; name: string }[] = [];
    let currentFolderId: string | null = selectedFolder;
    
    while (currentFolderId) {
      const folder = allFolders.find(f => f.id === currentFolderId);
      if (!folder) break;
      
      path.unshift({ id: folder.id, name: folder.name });
      currentFolderId = folder.parent_folder_id;
    }
    
    return path;
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedFolder && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFolder(null)}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-sm text-gray-700 hover:underline"
              >
                Drive
              </button>
              {selectedFolder && getBreadcrumbPath().map((folder, index) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={cn(
                    "text-sm hover:underline",
                    index === 0 ? "text-gray-500" : "text-gray-400"
                  )}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Folders Section */}
        {!selectedFolder && (
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateFolderInline}
                className="hover:bg-transparent active:bg-transparent focus:bg-transparent h-auto w-auto p-0"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </Button>
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
            {folders.length > 0 && (
              <FoldersList
                folders={folders}
                documents={documents}
                viewMode={viewMode}
                onFolderClick={setSelectedFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                editingFolderId={editingFolderId}
                onSaveFolderName={handleSaveFolderName}
                onCancelEdit={handleCancelEdit}
                onMoveFolder={handleMoveFolder}
                onDropDocument={handleDropDocumentOnFolder}
                allFolders={allFolders}
                currentFolderId={null}
              />
            )}
          </div>
        )}

        {/* Folder Contents - Subfolders and Documents */}
        {selectedFolder && (
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateSubfolder}
                className="hover:bg-transparent active:bg-transparent focus:bg-transparent h-auto w-auto p-0"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFolderFilters(!showFolderFilters)}
                className="hover:bg-transparent active:bg-transparent focus:bg-transparent h-auto w-auto p-0"
              >
                <Filter className="w-5 h-5 text-gray-600" />
              </Button>
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

            {showFolderFilters && (
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
            )}

            {/* Subfolders List */}
            {folders.length > 0 && (
              <FoldersList
                folders={folders}
                documents={documents}
                viewMode={viewMode}
                onFolderClick={setSelectedFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                editingFolderId={editingFolderId}
                onSaveFolderName={handleSaveFolderName}
                onCancelEdit={handleCancelEdit}
                onMoveFolder={handleMoveFolder}
                onDropDocument={handleDropDocumentOnFolder}
                allFolders={allFolders}
                currentFolderId={selectedFolder}
              />
            )}
            
            {/* Documents List */}
            <DocumentsTable 
              documents={filteredDocuments} 
              showProgress={false} 
              folders={folders}
              allFolders={allFolders}
              onDocumentMoved={handleDocumentMoved}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Drive;
