import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, FileCheck, Clock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const Reports = () => {
  const [dateFilter, setDateFilter] = useState("30");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Contar total de signatários
  const { data: totalCount } = useQuery({
    queryKey: ["signatories-count", dateFilter, statusFilter, searchTerm],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let query = supabase
        .from("document_signers")
        .select(`
          *,
          documents!inner(
            user_id,
            name
          )
        `, { count: "exact", head: true })
        .eq("documents.user_id", user.id);

      // Filtro de data
      if (dateFilter !== "all") {
        const days = parseInt(dateFilter);
        const date = new Date();
        date.setDate(date.getDate() - days);
        query = query.gte("created_at", date.toISOString());
      }

      // Filtro de status
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Filtro de busca
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Buscar signatários com paginação
  const { data: signatories, isLoading } = useQuery({
    queryKey: ["signatories-report", dateFilter, statusFilter, currentPage, itemsPerPage, searchTerm],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from("document_signers")
        .select(`
          *,
          documents!inner(
            user_id,
            name
          )
        `)
        .eq("documents.user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      // Filtro de data
      if (dateFilter !== "all") {
        const days = parseInt(dateFilter);
        const date = new Date();
        date.setDate(date.getDate() - days);
        query = query.gte("created_at", date.toISOString());
      }

      // Filtro de status
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Filtro de busca
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage);

  const handleExport = () => {
    if (!signatories || signatories.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const headers = ["Nome", "CPF/CNPJ", "Data de Nascimento", "Email", "Telefone", "Documento", "Status", "Data de Assinatura"];
    const csvData = signatories.map(s => [
      s.name,
      s.cpf || "-",
      s.birth_date ? format(new Date(s.birth_date), "dd/MM/yyyy", { locale: ptBR }) : "-",
      s.email,
      s.phone,
      s.documents?.name || "-",
      s.status === "signed" ? "Assinado" : s.status === "pending" ? "Pendente" : "Rejeitado",
      s.signed_at ? format(new Date(s.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-signatarios-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Relatório exportado com sucesso");
  };

  return <Layout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-600">Relatórios</h1>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="signatories">Signatários</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8 mt-8">

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
                <p className="text-2xl font-bold text-gray-600">87.5%</p>
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
                <p className="text-2xl font-bold text-gray-600">98</p>
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
                <p className="text-2xl font-bold text-gray-600">2.3d</p>
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
                <p className="text-2xl font-bold text-gray-600">234</p>
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
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">62.8%</span>
                  <span className="text-sm text-gray-600 font-semibold">98</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-700 text-white hover:bg-blue-700">Em Andamento</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">28.8%</span>
                  <span className="text-sm text-gray-600 font-semibold">45</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-700 text-white hover:bg-yellow-700">Pendente</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">15.2%</span>
                  <span className="text-sm text-gray-600 font-semibold">24</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-700 text-white hover:bg-red-700">Expirados</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">8.4%</span>
                  <span className="text-sm text-gray-600 font-semibold">13</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Signatários</h3>
            <div className="space-y-4">
              {[{
              name: "João Silva",
              docs: 24,
              email: "joao.silva@empresa.com"
            }, {
              name: "Maria Santos",
              docs: 19,
              email: "maria.santos@empresa.com"
            }, {
              name: "Pedro Costa",
              docs: 15,
              email: "pedro.costa@empresa.com"
            }, {
              name: "Ana Oliveira",
              docs: 12,
              email: "ana.oliveira@empresa.com"
            }].map(signer => <div key={signer.email} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{signer.name}</p>
                    <p className="text-sm text-muted-foreground">{signer.email}</p>
                  </div>
                  <Badge variant="secondary">{signer.docs} docs</Badge>
                </div>)}
            </div>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
          <div className="space-y-4">
            {[{
            action: "Documento assinado",
            doc: "Contrato - Cliente A",
            time: "Há 2 horas",
            status: "success"
          }, {
            action: "Documento enviado",
            doc: "Proposta Comercial",
            time: "Há 5 horas",
            status: "default"
          }, {
            action: "Documento assinado",
            doc: "NDA - Parceiro B",
            time: "Há 1 dia",
            status: "success"
          }, {
            action: "Documento expirado",
            doc: "Termo de Adesão",
            time: "Há 2 dias",
            status: "warning"
          }].map((activity, index) => <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                <div className={`w-2 h-2 rounded-full mt-2 ${activity.status === "success" ? "bg-success" : activity.status === "warning" ? "bg-warning" : "bg-primary"}`} />
                <div className="flex-1">
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.doc}</p>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>)}
          </div>
        </Card>
          </TabsContent>

          <TabsContent value="signatories" className="space-y-6 mt-8">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ ou email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-4">
                <Select value={dateFilter} onValueChange={(value) => {
                  setDateFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="365">Último ano</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="signed">Assinados</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Por página" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 por página</SelectItem>
                    <SelectItem value="25">25 por página</SelectItem>
                    <SelectItem value="50">50 por página</SelectItem>
                    <SelectItem value="100">100 por página</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleExport}
                className="bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>

            {/* Table */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Relatório de Signatários</h3>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : !signatories || signatories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum signatário encontrado</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>Nascimento</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Assinatura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signatories.map((signer) => (
                        <TableRow key={signer.id}>
                          <TableCell className="font-medium">{signer.name}</TableCell>
                          <TableCell>{signer.cpf || "-"}</TableCell>
                          <TableCell>
                            {signer.birth_date
                              ? format(new Date(signer.birth_date), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>{signer.email}</TableCell>
                          <TableCell>{signer.phone}</TableCell>
                          <TableCell>{signer.documents?.name || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                signer.status === "signed"
                                  ? "bg-green-700 text-white hover:bg-green-700"
                                  : "bg-yellow-700 text-white hover:bg-yellow-700"
                              }
                            >
                              {signer.status === "signed" ? "Assinado" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {signer.signed_at
                              ? format(new Date(signer.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Paginação */}
              {signatories && signatories.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} até{" "}
                    {Math.min(currentPage * itemsPerPage, totalCount || 0)} de {totalCount || 0}{" "}
                    registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      Primeira
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-4">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Última
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>;
};
export default Reports;