import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailHistoryItem {
  id: string;
  recipient_email: string;
  subject: string;
  email_type: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  document_id: string | null;
}

export function EmailHistoryTab() {
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<EmailHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEmailHistory();
  }, []);

  useEffect(() => {
    filterEmails();
  }, [searchTerm, filterType, filterStatus, emailHistory]);

  const loadEmailHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      setEmailHistory(data || []);
    } catch (error) {
      console.error("Error loading email history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEmails = () => {
    let filtered = [...emailHistory];

    // Filtrar por busca (email ou assunto)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.recipient_email.toLowerCase().includes(search) ||
          item.subject.toLowerCase().includes(search)
      );
    }

    // Filtrar por tipo
    if (filterType !== "all") {
      filtered = filtered.filter(item => item.email_type === filterType);
    }

    // Filtrar por status
    if (filterStatus !== "all") {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    setFilteredHistory(filtered);
  };

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      signature_invitation: "Convite de Assinatura",
      welcome: "Boas-vindas",
      document_completed: "Documento Concluído",
      password_reset: "Recuperação de Senha",
    };
    return labels[type] || type;
  };

  const getEmailTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      signature_invitation: "bg-blue-100 text-blue-700",
      welcome: "bg-green-100 text-green-700",
      document_completed: "bg-purple-100 text-purple-700",
      password_reset: "bg-orange-100 text-orange-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de E-mails</CardTitle>
        <CardDescription>Todos os e-mails enviados pelo sistema</CardDescription>
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
                placeholder="E-mail ou assunto..."
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
                <SelectItem value="welcome">Boas-vindas</SelectItem>
                <SelectItem value="document_completed">Documento Concluído</SelectItem>
                <SelectItem value="password_reset">Recuperação de Senha</SelectItem>
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
                <SelectItem value="failed">Falhou</SelectItem>
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
                <TableHead>Assunto</TableHead>
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
                    <Mail className="mx-auto h-12 w-12 mb-2 opacity-20" />
                    <p>Nenhum e-mail encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.recipient_email}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.subject}</TableCell>
                    <TableCell>
                      <Badge className={getEmailTypeColor(item.email_type)} variant="secondary">
                        {getEmailTypeLabel(item.email_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.status === 'sent' ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Enviado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">Falhou</span>
                        </div>
                      )}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{emailHistory.length}</p>
                <p className="text-sm text-muted-foreground">Total de E-mails</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {emailHistory.filter(e => e.status === 'sent').length}
                </p>
                <p className="text-sm text-muted-foreground">Enviados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {emailHistory.filter(e => e.status === 'failed').length}
                </p>
                <p className="text-sm text-muted-foreground">Falharam</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
