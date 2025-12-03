import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { DocumentsTable, Document, Folder } from "@/components/documents/DocumentsTable";
import { UploadDialog } from "@/components/documents/UploadDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, CheckCircle, User, Users, SlidersHorizontal, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useBryStatusSync } from "@/hooks/useBryStatusSync";

const Documents = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "signed");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const { toast } = useToast();

  const loadSignedDocuments = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Load all documents with envelope info
    const { data, error } = await supabase
      .from("documents")
      .select("*, envelopes(title)")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar documentos",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Group documents by envelope_id
    const envelopeGroups = new Map<string, typeof data>();
    const standaloneDocuments: typeof data = [];

    (data || []).forEach(doc => {
      if (doc.envelope_id) {
        const existing = envelopeGroups.get(doc.envelope_id) || [];
        existing.push(doc);
        envelopeGroups.set(doc.envelope_id, existing);
      } else {
        standaloneDocuments.push(doc);
      }
    });

    // Convert to display format
    const displayItems: any[] = [];

    // Add envelope groups
    envelopeGroups.forEach((docs, envelopeId) => {
      const firstDoc = docs[0];
      const envelopeTitle = (firstDoc as any).envelopes?.title || firstDoc.name;
      displayItems.push({
        ...firstDoc,
        name: envelopeTitle,
        isEnvelope: true,
        documentCount: docs.length,
        envelopeDocuments: docs,
      });
    });

    // Add standalone documents
    standaloneDocuments.forEach(doc => {
      displayItems.push({
        ...doc,
        isEnvelope: false,
        documentCount: 1,
      });
    });

    // Sort by created_at
    displayItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Load signers for each item
    const documentsWithSigners = await Promise.all(
      displayItems.map(async (item) => {
        const { data: signersData } = await supabase
          .from("document_signers")
          .select("*")
          .eq("document_id", item.id)
          .order("is_company_signer", { ascending: false });

        const signerNames = (signersData || []).map(s => s.name);
        const signerEmails = (signersData || []).map(s => s.email);
        const signerStatuses = (signersData || []).map(s => s.status as "pending" | "signed" | "rejected");

        // Format envelope documents for the dialog
        const envelopeDocuments = item.envelopeDocuments?.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          file_url: doc.file_url,
          status: doc.status,
          signed_by: doc.signed_by,
          signers: doc.signers,
          bry_signed_file_url: doc.bry_signed_file_url,
          bry_envelope_uuid: doc.bry_envelope_uuid,
        }));

        return {
          id: item.id,
          name: item.name,
          createdAt: new Date(item.created_at).toLocaleDateString('pt-BR'),
          status: item.status as "pending" | "signed" | "expired" | "in_progress",
          signers: item.signers,
          signedBy: item.signed_by,
          folderId: item.folder_id,
          signerStatuses,
          signerNames,
          signerEmails,
          bryEnvelopeUuid: item.bry_envelope_uuid,
          isEnvelope: item.isEnvelope,
          documentCount: item.documentCount,
          envelopeId: item.envelope_id,
          envelopeDocuments,
        };
      })
    );

    setDocuments(documentsWithSigners);
  }, [toast]);

  // Automatic BRy status sync
  useBryStatusSync(documents, {
    onStatusChange: loadSignedDocuments,
    pollingInterval: 30000, // 30 seconds
  });

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Erro ao carregar pastas:", error);
    } else {
      setFolders(data || []);
      setAllFolders(data || []);
    }
  };

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    loadSignedDocuments();
    loadFolders();
  }, [loadSignedDocuments]);

  useEffect(() => {
    filterDocuments();
  }, [searchQuery, sortBy, documents, activeTab, dateFrom, dateTo]);

  const filterDocuments = () => {
    let filtered = [...documents];

    // Filter by tab
    if (activeTab === "signed") {
      filtered = filtered.filter((doc) => doc.status === "signed" && doc.folderId === null);
    } else if (activeTab === "pending-internal") {
      filtered = filtered.filter(
        (doc) => doc.signerStatuses && doc.signerStatuses[0] === "pending"
      );
    } else if (activeTab === "pending-external") {
      filtered = filtered.filter(
        (doc) => doc.signerStatuses && doc.signerStatuses.slice(1).some(status => status === "pending")
      );
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(
        (doc) => {
          const docDate = new Date(doc.createdAt.split('/').reverse().join('-'));
          return docDate >= dateFrom;
        }
      );
    }

    if (dateTo) {
      filtered = filtered.filter(
        (doc) => {
          const docDate = new Date(doc.createdAt.split('/').reverse().join('-'));
          return docDate <= dateTo;
        }
      );
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

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-600">Documentos</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="w-10 h-10 rounded-full hover:bg-transparent active:bg-transparent focus:bg-transparent"
            >
              <SlidersHorizontal className="w-5 h-5 text-gray-600" />
            </Button>
            <UploadDialog />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signed" className="data-[state=active]:text-gray-700">
              <CheckCircle className="w-4 h-4 md:mr-2 text-gray-700" />
              <span className="hidden md:inline">Assinados</span>
            </TabsTrigger>
            <TabsTrigger value="pending-internal" className="data-[state=active]:text-yellow-700">
              <User className="w-4 h-4 md:mr-2 text-yellow-700" />
              <span className="hidden md:inline">Pendente Interno</span>
            </TabsTrigger>
            <TabsTrigger value="pending-external" className="data-[state=active]:text-red-700">
              <Users className="w-4 h-4 md:mr-2 text-red-700" />
              <span className="hidden md:inline">Pendente Externo</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signed" className="mt-6 space-y-6">
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
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
            )}

            {/* Documents Table */}
            <DocumentsTable 
              documents={filteredDocuments}
              folders={folders}
              allFolders={allFolders}
              onDocumentMoved={loadSignedDocuments}
              showFolderActions={true}
            />
          </TabsContent>

          <TabsContent value="pending-internal" className="mt-6 space-y-6">
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
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
            )}

            {/* Documents Table */}
            <DocumentsTable documents={filteredDocuments} />
          </TabsContent>

          <TabsContent value="pending-external" className="mt-6 space-y-6">
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
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
            )}

            {/* Documents Table */}
            <DocumentsTable documents={filteredDocuments} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Documents;
