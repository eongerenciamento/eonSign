import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, MessageCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppHistoryItem {
  id: string;
  recipient_phone: string;
  recipient_name: string;
  message_type: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  document_id: string | null;
}

export function WhatsAppHistoryTab() {
  const [whatsappHistory, setWhatsappHistory] = useState<WhatsAppHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<WhatsAppHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      await loadWhatsAppHistory();

      // Subscribe to realtime updates
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('whatsapp_history_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'whatsapp_history',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadWhatsAppHistory();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    filterMessages();
  }, [searchTerm, filterType, filterStatus, whatsappHistory]);

  const loadWhatsAppHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_history')
        .select('*')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      setWhatsappHistory(data || []);
    } catch (error) {
      console.error("Error loading WhatsApp history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterMessages = () => {
    let filtered = [...whatsappHistory];

    // Filtrar por busca (telefone ou nome)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.recipient_phone.toLowerCase().includes(search) ||
          item.recipient_name.toLowerCase().includes(search)
      );
    }

    // Filtrar por tipo
    if (filterType !== "all") {
      filtered = filtered.filter(item => item.message_type === filterType);
    }

    // Filtrar por status
    if (filterStatus !== "all") {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    setFilteredHistory(filtered);
  };

  const getMessageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      signature_invitation: "Convite de Assinatura",
      document_completed: "Documento Concluído",
    };
    return labels[type] || type;
  };

  const getMessageTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      signature_invitation: "bg-blue-100 text-blue-700",
      document_completed: "bg-purple-100 text-purple-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'read':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'failed':
      case 'undelivered':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      sent: "Enviado",
      delivered: "Entregue",
      read: "Lido",
      failed: "Falhou",
      undelivered: "Não Entregue",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      sent: "text-yellow-600",
      delivered: "text-green-600",
      read: "text-blue-600",
      failed: "text-red-600",
      undelivered: "text-red-600",
    };
    return colors[status] || "text-gray-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de WhatsApp</CardTitle>
        <CardDescription>Todas as mensagens WhatsApp enviadas pelo sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Telefone ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type-filter">Tipo</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger id="type-filter">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="signature_invitation">Convite de Assinatura</SelectItem>
                <SelectItem value="document_completed">Documento Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="read">Lido</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="undelivered">Não Entregue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinatário</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="mx-auto h-12 w-12 mb-2 opacity-20" />
                    <p>Nenhuma mensagem encontrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.recipient_name}</TableCell>
                    <TableCell>{item.recipient_phone}</TableCell>
                    <TableCell>
                      <Badge className={getMessageTypeColor(item.message_type)} variant="secondary">
                        {getMessageTypeLabel(item.message_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}
                        <span className="text-sm">{getStatusLabel(item.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{whatsappHistory.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {whatsappHistory.filter(m => m.status === 'delivered').length}
                </p>
                <p className="text-sm text-muted-foreground">Entregues</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {whatsappHistory.filter(m => m.status === 'read').length}
                </p>
                <p className="text-sm text-muted-foreground">Lidas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {whatsappHistory.filter(m => m.status === 'failed' || m.status === 'undelivered').length}
                </p>
                <p className="text-sm text-muted-foreground">Falhas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}