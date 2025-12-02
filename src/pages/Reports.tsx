import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, FileCheck, Clock, ChevronLeft, ChevronRight, Search, FileText, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, FileDown } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
const Reports = () => {
  const isMobile = useIsMobile();
  const [dateFilter, setDateFilter] = useState("30");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"name" | "signed_at" | "status">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Contar total de signatários
  const {
    data: totalCount
  } = useQuery({
    queryKey: ["signatories-count", dateFilter, statusFilter, searchTerm],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      let query = supabase.from("document_signers").select(`
          *,
          documents!inner(
            user_id,
            name
          )
        `, {
        count: "exact",
        head: true
      }).eq("documents.user_id", user.id);

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
      const {
        count,
        error
      } = await query;
      if (error) throw error;
      return count || 0;
    }
  });

  // Buscar signatários com paginação
  const {
    data: signatories,
    isLoading
  } = useQuery({
    queryKey: ["signatories-report", dateFilter, statusFilter, currentPage, itemsPerPage, searchTerm, sortField, sortDirection],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      let query = supabase.from("document_signers").select(`
          *,
          signature_ip,
          documents!inner(
            user_id,
            name
          )
        `).eq("documents.user_id", user.id).order(sortField, {
        ascending: sortDirection === "asc"
      }).range(from, to);

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
      const {
        data,
        error
      } = await query;
      if (error) throw error;
      return data;
    }
  });
  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage);
  const handleSort = (field: "name" | "signed_at" | "status") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };
  const SortIcon = ({
    field
  }: {
    field: "name" | "signed_at" | "status";
  }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  // Buscar configurações da empresa para o logo
  const {
    data: companySettings
  } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const {
        data,
        error
      } = await supabase.from("company_settings").select("*").eq("user_id", user.id).single();
      if (error) throw error;
      return data;
    }
  });
  const handleExportCSV = () => {
    if (!signatories || signatories.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }
    const headers = ["Nome", "CPF/CNPJ", "Data de Nascimento", "Email", "Telefone", "Documento", "Status", "Data Assinatura", "IP", "Localização"];
    const csvData = signatories.map(s => [s.name, s.cpf || "-", s.birth_date ? format(new Date(s.birth_date), "dd/MM/yyyy", {
      locale: ptBR
    }) : "-", s.email, s.phone, s.documents?.name || "-", s.status === "signed" ? "Assinado" : s.status === "pending" ? "Pendente" : "Rejeitado", s.signed_at ? format(new Date(s.signed_at), "dd/MM/yyyy HH:mm", {
      locale: ptBR
    }) : "-", s.signature_ip || "-", s.signature_city && s.signature_state ? `${s.signature_city}, ${s.signature_state}` : "-"]);
    const csvContent = [headers.join(","), ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-signatarios-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Relatório CSV exportado com sucesso");
  };
  const handleExportPDF = async () => {
    if (!signatories || signatories.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }
    const doc = new jsPDF({
      orientation: "landscape"
    });

    // Adicionar logo se disponível
    if (companySettings?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = companySettings.logo_url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        doc.addImage(img, "PNG", 14, 10, 30, 30);
      } catch (error) {
        console.error("Erro ao carregar logo:", error);
      }
    }

    // Header com informações da empresa
    doc.setFontSize(18);
    doc.setTextColor(39, 61, 96);
    doc.text(companySettings?.company_name || "Éon Sign", 50, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Relatório de Signatários", 50, 28);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", {
      locale: ptBR
    })}`, 50, 34);

    // Informações dos filtros aplicados
    const filters = [];
    if (dateFilter !== "all") {
      const filterLabels: Record<string, string> = {
        "7": "Últimos 7 dias",
        "30": "Últimos 30 dias",
        "90": "Últimos 90 dias",
        "365": "Último ano"
      };
      filters.push(`Período: ${filterLabels[dateFilter]}`);
    }
    if (statusFilter !== "all") {
      filters.push(`Status: ${statusFilter === "signed" ? "Assinados" : "Pendentes"}`);
    }
    if (searchTerm) {
      filters.push(`Busca: ${searchTerm}`);
    }
    if (filters.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Filtros: ${filters.join(" | ")}`, 14, 44);
    }

    // Tabela com dados
    const tableData = signatories.map(s => [`${s.name}\n${s.cpf || "CPF não informado"}`,
    // Nome com CPF abaixo
    s.birth_date ? format(new Date(s.birth_date), "dd/MM/yyyy", {
      locale: ptBR
    }) : "-", s.email, s.phone, s.documents?.name || "-", s.status === "signed" ? "Assinado" : "Pendente", s.signed_at ? format(new Date(s.signed_at), "dd/MM/yyyy", {
      locale: ptBR
    }) : "-", s.signature_ip || "-", s.signature_city && s.signature_state ? `${s.signature_city}, ${s.signature_state}` : "-"]);

    // Calcular totalizadores
    const totalSignatories = signatories.length;
    const totalSigned = signatories.filter(s => s.status === "signed").length;
    const totalPending = signatories.filter(s => s.status === "pending").length;
    autoTable(doc, {
      head: [["Nome / CPF", "Nascimento", "Email", "Telefone", "Documento", "Status", "Assinatura", "IP", "Localização"]],
      body: tableData,
      startY: filters.length > 0 ? 50 : 45,
      styles: {
        fontSize: 9,
        cellPadding: 4
      },
      headStyles: {
        fillColor: [39, 61, 96],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: {
          cellWidth: 46
        },
        // Nome + CPF
        1: {
          cellWidth: 22
        },
        // Nascimento
        2: {
          cellWidth: 44
        },
        // Email
        3: {
          cellWidth: 26
        },
        // Telefone
        4: {
          cellWidth: 38
        },
        // Documento
        5: {
          cellWidth: 20
        },
        // Status
        6: {
          cellWidth: 24
        },
        // Assinatura
        7: {
          cellWidth: 28
        },
        // IP
        8: {
          cellWidth: 38
        } // Localização
      },
      didDrawCell: data => {
        // Estilizar CPF em fonte menor
        if (data.column.index === 0 && data.section === 'body') {
          const cell = data.cell;
          const text = cell.text[0];
          if (text && text.includes('\n')) {
            const [name, cpf] = text.split('\n');
            const textX = cell.x + 2;
            const textY = cell.y + 5;
            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
            doc.text(name, textX, textY);
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.text(cpf, textX, textY + 5);

            // Limpar o texto automático
            cell.text = [];
          }
        }
      }
    });

    // Adicionar totalizadores após a tabela
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setTextColor(39, 61, 96);
    doc.text("Totalizadores:", 14, finalY);
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total de Signatários: ${totalSignatories}`, 14, finalY + 8);
    doc.text(`Assinados: ${totalSigned}`, 14, finalY + 16);
    doc.text(`Pendentes: ${totalPending}`, 14, finalY + 24);

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, {
        align: "center"
      });
    }
    doc.save(`relatorio-signatarios-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Relatório PDF exportado com sucesso");
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
          <Card className="p-6 bg-gray-100 border-0">
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

          <Card className="p-6 bg-gray-100 border-0">
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

          <Card className="p-6 bg-gray-100 border-0">
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

          <Card className="p-6 bg-gray-100 border-0">
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
          <Card className="p-6 bg-gray-100 border-0">
            <h3 className="font-semibold mb-4 text-gray-600 text-base">Documentos por Status</h3>
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

          <Card className="p-6 bg-gray-100 border-0">
            <h3 className="font-semibold mb-4 text-base text-gray-600">Top Signatários</h3>
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
                    <p className="font-medium text-gray-600 text-sm">{signer.name}</p>
                    <p className="text-muted-foreground text-xs">{signer.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-gray-600">{signer.docs} docs</Badge>
                </div>)}
            </div>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="p-6 bg-gray-100 border-0">
          <h3 className="font-semibold mb-4 text-gray-600 text-base">Atividade Recente</h3>
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
                  <p className="font-medium text-gray-600 text-sm">{activity.action}</p>
                  <p className="text-gray-500 text-xs">{activity.doc}</p>
                </div>
                <span className="text-muted-foreground text-xs">{activity.time}</span>
              </div>)}
          </div>
        </Card>
          </TabsContent>

          <TabsContent value="signatories" className="space-y-6 mt-8">
            {/* Search and Action Buttons */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                <Input placeholder="Nome, CPF/CNPJ ou e-mail" value={searchInput} onChange={e => setSearchInput(e.target.value)} className="pl-10 rounded-full text-sm placeholder:text-xs" />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={() => setShowFilters(!showFilters)} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-500 hover:bg-transparent hover:text-gray-500">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <Button onClick={handleExportCSV} disabled={!signatories || signatories.length === 0} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-500 hover:bg-transparent hover:text-gray-500">
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button onClick={handleExportPDF} disabled={!signatories || signatories.length === 0} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-500 hover:bg-transparent hover:text-gray-500">
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters - Collapsible */}
            {showFilters && <div className="flex flex-wrap gap-4">
                <Select value={dateFilter} onValueChange={value => {
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
                <Select value={statusFilter} onValueChange={value => {
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
                <Select value={itemsPerPage.toString()} onValueChange={value => {
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
              </div>}

            {/* Table / Cards */}
            <Card className="p-6 bg-gray-100 border-0">
              <h3 className="text-lg font-semibold mb-4">Relatório de Signatários</h3>
              {isLoading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : !signatories || signatories.length === 0 ? <div className="text-center py-8 text-muted-foreground">Nenhum signatário encontrado</div> : isMobile ? (/* Mobile view - Cards */
            <div className="space-y-4">
                  {signatories.map(signer => <div key={signer.id} className="bg-gray-100 p-4 rounded-lg space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">{signer.name}</span>
                        <span className="text-xs text-muted-foreground">{signer.cpf || "CPF não informado"}</span>
                      </div>
                      
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nascimento:</span>
                          <span className="font-medium">
                            {signer.birth_date ? format(new Date(signer.birth_date), "dd/MM/yyyy", {
                        locale: ptBR
                      }) : "-"}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium text-xs break-all">{signer.email}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Telefone:</span>
                          <span className="font-medium">{signer.phone}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Documento:</span>
                          <span className="font-medium text-xs">{signer.documents?.name || "-"}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge className={signer.status === "signed" ? "bg-green-700 text-white hover:bg-green-700" : "bg-yellow-700 text-white hover:bg-yellow-700"}>
                            {signer.status === "signed" ? "Assinado" : "Pendente"}
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Data Assinatura:</span>
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-xs">
                              {signer.signed_at ? format(new Date(signer.signed_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR
                        }) : "-"}
                            </span>
                            {signer.signature_ip && <span className="text-xs text-muted-foreground">IP: {signer.signature_ip}</span>}
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Localização:</span>
                          {signer.signature_city && signer.signature_state ? <a href={`https://www.google.com/maps?q=${signer.signature_latitude},${signer.signature_longitude}`} target="_blank" rel="noopener noreferrer" className="font-medium text-xs text-blue-600 hover:underline">
                              {signer.signature_city}, {signer.signature_state} - {signer.signature_country || "Brasil"}
                            </a> : <span className="font-medium text-xs">-</span>}
                        </div>
                      </div>
                    </div>)}
                </div>) : (/* Desktop view - Table */
            <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button onClick={() => handleSort("name")} className="flex items-center hover:text-foreground transition-colors">
                            Nome / CPF
                            <SortIcon field="name" />
                          </button>
                        </TableHead>
                        <TableHead>Nascimento</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>
                          <button onClick={() => handleSort("status")} className="flex items-center hover:text-foreground transition-colors">
                            Status
                            <SortIcon field="status" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button onClick={() => handleSort("signed_at")} className="flex items-center hover:text-foreground transition-colors">
                            Data Assinatura
                            <SortIcon field="signed_at" />
                          </button>
                        </TableHead>
                        <TableHead>Localização</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signatories.map(signer => <TableRow key={signer.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{signer.name}</span>
                              <span className="text-xs text-muted-foreground">{signer.cpf || "CPF não informado"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {signer.birth_date ? format(new Date(signer.birth_date), "dd/MM/yyyy", {
                        locale: ptBR
                      }) : "-"}
                          </TableCell>
                          <TableCell>{signer.email}</TableCell>
                          <TableCell>{signer.phone}</TableCell>
                          <TableCell>{signer.documents?.name || "-"}</TableCell>
                          <TableCell>
                            <Badge className={signer.status === "signed" ? "bg-green-700 text-white hover:bg-green-700" : "bg-yellow-700 text-white hover:bg-yellow-700"}>
                              {signer.status === "signed" ? "Assinado" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {signer.signed_at ? <div className="flex flex-col">
                                <span>{format(new Date(signer.signed_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR
                          })}</span>
                                {signer.signature_ip && <span className="text-xs text-muted-foreground">IP: {signer.signature_ip}</span>}
                              </div> : "-"}
                          </TableCell>
                          <TableCell>
                            {signer.signature_city && signer.signature_state ? <a href={`https://www.google.com/maps?q=${signer.signature_latitude},${signer.signature_longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {signer.signature_city}, {signer.signature_state} - {signer.signature_country || "Brasil"}
                              </a> : "-"}
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>)}

              {/* Paginação */}
              {signatories && signatories.length > 0 && <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} até{" "}
                    {Math.min(currentPage * itemsPerPage, totalCount || 0)} de {totalCount || 0}{" "}
                    registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                      Primeira
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-4">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                      Última
                    </Button>
                  </div>
                </div>}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>;
};
export default Reports;