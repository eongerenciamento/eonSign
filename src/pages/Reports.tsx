import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, FileCheck, Clock, ChevronLeft, ChevronRight, Search, FileText, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, FileDown, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// Função para extrair iniciais do nome
const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
};

// Função para abreviar texto (primeiras 3 letras + ponto)
const getAbbreviation = (text: string) => {
  return text.slice(0, 3) + '.';
};

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
  const [animateBars, setAnimateBars] = useState(false);

  // Animate bars on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimateBars(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Buscar contagem de documentos por status
  const { data: documentStatusData } = useQuery({
    queryKey: ["document-status-counts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: documents, error } = await supabase
        .from("documents")
        .select("status")
        .eq("user_id", user.id);

      if (error) throw error;

      const counts = {
        signed: 0,
        pending: 0,
        rejected: 0,
        expired: 0,
        cancelled: 0
      };

      documents?.forEach(doc => {
        if (doc.status === "signed" || doc.status === "completed") counts.signed++;
        else if (doc.status === "pending") counts.pending++;
        else if (doc.status === "rejected") counts.rejected++;
        else if (doc.status === "expired") counts.expired++;
        else if (doc.status === "cancelled") counts.cancelled++;
      });

      const total = documents?.length || 1;
      return [
        { label: "Assinados", count: counts.signed, percentage: Math.round((counts.signed / total) * 100), color: "bg-blue-500" },
        { label: "Pendentes", count: counts.pending, percentage: Math.round((counts.pending / total) * 100), color: "bg-blue-300" },
        { label: "Rejeitados", count: counts.rejected, percentage: Math.round((counts.rejected / total) * 100), color: "bg-red-500" },
        { label: "Expirados", count: counts.expired, percentage: Math.round((counts.expired / total) * 100), color: "bg-purple-500" },
        { label: "Cancelados", count: counts.cancelled, percentage: Math.round((counts.cancelled / total) * 100), color: "bg-yellow-500" }
      ];
    }
  });

  // Buscar top signatários
  const { data: topSignatories } = useQuery({
    queryKey: ["top-signatories"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: signers, error } = await supabase
        .from("document_signers")
        .select(`
          name,
          status,
          documents!inner(user_id)
        `)
        .eq("documents.user_id", user.id)
        .eq("status", "signed");

      if (error) throw error;

      // Contar assinaturas por signatário
      const signerCounts: Record<string, number> = {};
      signers?.forEach(signer => {
        signerCounts[signer.name] = (signerCounts[signer.name] || 0) + 1;
      });

      // Ordenar e pegar top 5
      const sorted = Object.entries(signerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      const maxCount = sorted[0]?.[1] || 1;
      const colors = ["bg-blue-500", "bg-blue-400", "bg-blue-300", "bg-blue-200", "bg-blue-100"];

      return sorted.map(([name, count], index) => ({
        label: name,
        count,
        percentage: Math.round((count / maxCount) * 100),
        color: colors[index] || "bg-blue-100"
      }));
    }
  });

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
            <h1 className="text-sm font-bold text-muted-foreground">Relatórios</h1>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="signatories" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Signatários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8 mt-8">

        {/* Filters */}
        <div className="flex gap-4">
          <Select defaultValue="30">
            <SelectTrigger className="w-[180px] border-none bg-secondary">
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
            <SelectTrigger className="w-[180px] border-none bg-secondary">
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
          <Card className="p-6 bg-secondary border-0 shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-muted">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">87.5%</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-secondary border-0 shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-muted">
                <FileCheck className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Docs Assinados</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">98</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-secondary border-0 shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">2.3d</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-secondary border-0 shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-muted">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Signatários Ativos</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">234</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-secondary border-0 animate-fade-in">
            <h3 className="font-semibold mb-4 text-base text-muted-foreground">Documentos por Status</h3>
            <div className="flex items-end justify-between gap-4 pt-4">
              {(documentStatusData || [
                { label: "Assinados", count: 0, percentage: 0, color: "bg-blue-500" },
                { label: "Pendentes", count: 0, percentage: 0, color: "bg-blue-300" },
                { label: "Rejeitados", count: 0, percentage: 0, color: "bg-red-500" },
                { label: "Expirados", count: 0, percentage: 0, color: "bg-purple-500" },
                { label: "Cancelados", count: 0, percentage: 0, color: "bg-yellow-500" }
              ]).map((item, index) => (
                <div key={item.label} className="flex flex-col items-center flex-1">
                  <span className="text-lg font-bold text-foreground">{item.count}</span>
                  <span className="text-xs text-muted-foreground mb-2">{item.percentage}%</span>
                  <div className="w-full h-24 bg-muted rounded-lg relative overflow-hidden">
                    <div 
                      className={`absolute bottom-0 left-0 right-0 ${item.color} rounded-lg transition-all duration-700 ease-out`}
                      style={{ 
                        height: animateBars ? `${Math.max(item.percentage, 0)}%` : '0%',
                        transitionDelay: `${index * 100}ms`
                      }}
                    />
                  </div>
<span className="text-xs text-muted-foreground mt-2 text-center">
                    {isMobile ? getAbbreviation(item.label) : item.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-secondary border-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <h3 className="font-semibold mb-4 text-base text-muted-foreground">Top Signatários</h3>
            <div className="flex items-end justify-between gap-4 pt-4">
              {(topSignatories && topSignatories.length > 0 ? topSignatories : [
                { label: "Sem dados", count: 0, percentage: 0, color: "bg-muted" }
              ]).map((item, index) => (
                <div key={item.label} className="flex flex-col items-center flex-1">
                  <span className="text-lg font-bold text-foreground">{item.count}</span>
                  <span className="text-xs text-muted-foreground mb-2">{item.percentage}%</span>
                  <div className="w-full h-24 bg-muted rounded-lg relative overflow-hidden">
                    <div 
                      className={`absolute bottom-0 left-0 right-0 ${item.color} rounded-lg transition-all duration-700 ease-out`}
                      style={{ 
                        height: animateBars ? `${Math.max(item.percentage, 0)}%` : '0%',
                        transitionDelay: `${(index * 100) + 200}ms`
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground mt-2 text-center truncate w-full">
                    {isMobile ? getInitials(item.label) : item.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="p-6 bg-secondary border-0">
          <h3 className="font-semibold mb-4 text-muted-foreground text-base">Atividade Recente</h3>
          <div className="space-y-3">
            {[{
                doc: "Contrato - Cliente A",
                signers: ["João Silva", "Maria Santos"],
                date: "18/12/2025",
                status: "Assinado"
              }, {
                doc: "Proposta Comercial",
                signers: ["Pedro Costa"],
                date: "17/12/2025",
                status: "Pendente"
              }, {
                doc: "NDA - Parceiro B",
                signers: ["Ana Oliveira", "Carlos Lima"],
                date: "16/12/2025",
                status: "Assinado"
              }, {
                doc: "Termo de Adesão",
                signers: ["Roberto Souza"],
                date: "15/12/2025",
                status: "Expirado"
              }, {
                doc: "Contrato de Serviços",
                signers: ["Fernanda Reis", "Lucas Martins"],
                date: "14/12/2025",
                status: "Assinado"
              }, {
                doc: "Acordo de Parceria",
                signers: ["Juliana Alves"],
                date: "14/12/2025",
                status: "Pendente"
              }, {
                doc: "Proposta Técnica",
                signers: ["Marcos Pereira", "Camila Rocha"],
                date: "13/12/2025",
                status: "Assinado"
              }, {
                doc: "Termo de Confidencialidade",
                signers: ["Ricardo Gomes"],
                date: "13/12/2025",
                status: "Pendente"
              }, {
                doc: "Contrato de Trabalho",
                signers: ["Patrícia Dias", "Bruno Fernandes"],
                date: "12/12/2025",
                status: "Assinado"
              }, {
                doc: "Aditivo Contratual",
                signers: ["Sandra Costa"],
                date: "12/12/2025",
                status: "Enviado"
              }].map((activity, index) => (
              <div key={index} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{activity.doc}</p>
                </div>
                <div className="w-32 min-w-[128px]">
                  {activity.signers.map((signer, i) => (
                    <p key={i} className="text-muted-foreground text-xs truncate">{signer}</p>
                  ))}
                </div>
                <div className="w-24 text-right">
                  <span className="text-muted-foreground text-xs">{activity.date}</span>
                </div>
                <div className="w-20 text-right">
                  <span className={`text-xs font-medium ${
                    activity.status === "Assinado" ? "text-green-600" : 
                    activity.status === "Pendente" ? "text-yellow-600" : 
                    activity.status === "Expirado" ? "text-red-600" : 
                    "text-blue-600"
                  }`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
          </TabsContent>

          <TabsContent value="signatories" className="space-y-6 mt-8">
            {/* Search and Action Buttons */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Nome, CPF/CNPJ ou e-mail" value={searchInput} onChange={e => setSearchInput(e.target.value)} className="pl-10 rounded-full text-sm placeholder:text-xs border-0 bg-secondary" />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={() => setShowFilters(!showFilters)} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button disabled={!signatories || signatories.length === 0} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover backdrop-blur-sm border-border">
                    <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer hover:bg-accent focus:bg-accent">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer hover:bg-accent focus:bg-accent">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      XLS
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Filters - Collapsible */}
            {showFilters && <div className="flex flex-wrap gap-4">
                <Select value={dateFilter} onValueChange={value => {
              setDateFilter(value);
              setCurrentPage(1);
            }}>
                  <SelectTrigger className="w-[180px] border-0 bg-secondary">
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
                  <SelectTrigger className="w-[180px] border-0 bg-secondary">
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
                  <SelectTrigger className="w-[140px] border-0 bg-secondary">
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
            <Card className="p-6 bg-secondary border-0">
              <h3 className="text-sm md:text-lg font-semibold mb-4 text-muted-foreground">Relatório de Signatários</h3>
              {isLoading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : !signatories || signatories.length === 0 ? <div className="text-center py-8 text-muted-foreground">Nenhum signatário encontrado</div> : isMobile ? (/* Mobile view - Cards */
            <div className="space-y-4 -mx-8">
                  {signatories.map((signer, index) => <div key={signer.id} className={`py-4 px-8 space-y-3 ${index % 2 === 0 ? 'bg-secondary' : 'bg-card'}`}>
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
                          <span className="text-muted-foreground">Email / Telefone:</span>
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-xs break-all">{signer.email}</span>
                            <span className="font-medium text-xs text-muted-foreground">{signer.phone}</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Documento:</span>
                          <span className="font-medium text-xs">{signer.documents?.name || "-"}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge className={
                            signer.status === "signed" 
                              ? "bg-transparent border border-blue-700 text-blue-700 hover:bg-transparent" 
                              : signer.status === "rejected"
                              ? "bg-transparent border border-red-600 text-red-600 hover:bg-transparent"
                              : signer.status === "cancelled"
                              ? "bg-transparent border border-yellow-600 text-yellow-600 hover:bg-transparent"
                              : "bg-transparent border border-gray-500 text-gray-500 hover:bg-transparent"
                          }>
                            {signer.status === "signed" ? "Assinado" : signer.status === "rejected" ? "Rejeitado" : signer.status === "cancelled" ? "Cancelado" : "Pendente"}
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
            <div className="overflow-x-auto rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted">
                        <TableHead className="rounded-tl-lg">
                          <button onClick={() => handleSort("name")} className="flex items-center hover:text-foreground transition-colors">
                            Nome / CPF
                            <SortIcon field="name" />
                          </button>
                        </TableHead>
                        <TableHead>Nascimento</TableHead>
                        <TableHead>Email / Telefone</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead className="text-center">
                          <button onClick={() => handleSort("signed_at")} className="flex items-center justify-center hover:text-foreground transition-colors w-full">
                            Data Assinatura
                            <SortIcon field="signed_at" />
                          </button>
                        </TableHead>
                        <TableHead className="text-center">Localização</TableHead>
                        <TableHead className="text-center rounded-tr-lg">
                          <button onClick={() => handleSort("status")} className="flex items-center justify-center hover:text-foreground transition-colors w-full">
                            Status
                            <SortIcon field="status" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signatories.map((signer, index) => {
                        const isLast = index === signatories.length - 1;
                        return (
                          <TableRow key={signer.id} className={index % 2 === 0 ? "bg-card" : "bg-secondary/50"}>
                            <TableCell className={`font-medium ${isLast ? "rounded-bl-lg" : ""}`}>
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
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm">{signer.email}</span>
                                <span className="text-xs text-muted-foreground">{signer.phone}</span>
                              </div>
                            </TableCell>
                            <TableCell>{signer.documents?.name || "-"}</TableCell>
                            <TableCell className="text-center">
                              {signer.signed_at ? <div className="flex flex-col items-center">
                                  <span>{format(new Date(signer.signed_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR
                            })}</span>
                                  {signer.signature_ip && <span className="text-xs text-muted-foreground">IP: {signer.signature_ip}</span>}
                                </div> : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              {signer.signature_city && signer.signature_state ? <a href={`https://www.google.com/maps?q=${signer.signature_latitude},${signer.signature_longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {signer.signature_city}, {signer.signature_state} - {signer.signature_country || "Brasil"}
                                </a> : "-"}
                            </TableCell>
                            <TableCell className={`text-center ${isLast ? "rounded-br-lg" : ""}`}>
                              <Badge className={
                                signer.status === "signed" 
                                  ? "bg-transparent border border-blue-700 text-blue-700 hover:bg-transparent" 
                                  : signer.status === "rejected"
                                  ? "bg-transparent border border-red-600 text-red-600 hover:bg-transparent"
                                  : signer.status === "cancelled"
                                  ? "bg-transparent border border-yellow-600 text-yellow-600 hover:bg-transparent"
                                  : "bg-transparent border border-gray-500 text-gray-500 hover:bg-transparent"
                              }>
                                {signer.status === "signed" ? "Assinado" : signer.status === "rejected" ? "Rejeitado" : signer.status === "cancelled" ? "Cancelado" : "Pendente"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                    <Button variant="ghost" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-full">
                      Primeira
                    </Button>
                    <Button size="icon" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="rounded-full h-8 w-8 bg-[#273d60] hover:bg-[#1e2f4d] text-white border-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-col items-center px-4">
                      <span className="text-xs font-medium text-muted-foreground">
                        <span className="hidden md:inline">Página</span><span className="md:hidden">Pág.</span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {currentPage} de {totalPages}
                      </span>
                    </div>
                    <Button size="icon" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="rounded-full h-8 w-8 bg-[#273d60] hover:bg-[#273d60]/90 text-white border-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-full">
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