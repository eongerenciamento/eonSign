import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Send, X, Search, User, Building2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  ticket_number: string;
  created_at: string;
  user_id: string;
  user_name: string;
  user_email: string;
  company_name: string;
}

interface Message {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

export const AdminTicketsTab = () => {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-all-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-list-all-tickets");
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["admin-ticket-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase.functions.invoke("admin-get-ticket-messages", {
        body: { ticketId: selectedTicket.id },
      });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedTicket,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      const { error } = await supabase.functions.invoke("admin-update-ticket", {
        body: { ticketId, message },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["admin-all-tickets"] });
      toast.success("Mensagem enviada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar mensagem: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await supabase.functions.invoke("admin-update-ticket", {
        body: { ticketId, status },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-tickets"] });
      toast.success("Status atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      aberto: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Aberto" },
      em_andamento: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Em Andamento" },
      resolvido: { bg: "bg-green-500/20", text: "text-green-400", label: "Resolvido" },
      fechado: { bg: "bg-muted", text: "text-muted-foreground", label: "Fechado" },
    };
    const config = statusConfig[status] || statusConfig.aberto;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const filteredTickets = tickets?.filter((ticket) => {
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleSendMessage = () => {
    if (!selectedTicket || !newMessage.trim()) return;
    sendMessageMutation.mutate({ ticketId: selectedTicket.id, message: newMessage.trim() });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, email, empresa ou número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-0"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48 bg-secondary border-0">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="resolvido">Resolvido</SelectItem>
            <SelectItem value="fechado">Fechado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredTickets && filteredTickets.length > 0 ? (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="bg-white dark:bg-gray-900 border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700 dark:text-blue-400 font-medium text-sm">
                    {ticket.ticket_number}
                  </span>
                  <Select
                    value={ticket.status}
                    onValueChange={(status) => updateStatusMutation.mutate({ ticketId: ticket.id, status })}
                  >
                    <SelectTrigger className="w-auto h-7 border-0 bg-transparent p-0">
                      {getStatusBadge(ticket.status)}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                      <SelectItem value="fechado">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <p className="font-medium text-foreground text-sm">{ticket.title}</p>
                
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-foreground">{ticket.user_name}</p>
                    <p className="text-xs text-muted-foreground">{ticket.user_email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{ticket.company_name}</span>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTicket(ticket)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-white dark:bg-gray-900 border-0 shadow-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum ticket encontrado
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tickets Table - Desktop */}
      <Card className="hidden md:block bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white dark:bg-gray-900">
                  <th className="text-left p-4 font-semibold text-sm text-foreground rounded-tl-lg">Usuário</th>
                  <th className="text-left p-4 font-semibold text-sm text-foreground">Empresa</th>
                  <th className="text-left p-4 font-semibold text-sm text-foreground">Título</th>
                  <th className="text-left p-4 font-semibold text-sm text-foreground">Ticket</th>
                  <th className="text-left p-4 font-semibold text-sm text-foreground">Data</th>
                  <th className="text-left p-4 font-semibold text-sm text-foreground">Status</th>
                  <th className="text-right p-4 font-semibold text-sm text-foreground rounded-tr-lg">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets && filteredTickets.length > 0 ? (
                  filteredTickets.map((ticket, index) => (
                    <tr
                      key={ticket.id}
                      className={`hover:bg-gray-200 dark:hover:bg-gray-700 ${index % 2 === 0 ? "bg-gray-100 dark:bg-gray-800" : "bg-white dark:bg-gray-900"}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{ticket.user_name}</p>
                            <p className="text-xs text-muted-foreground">{ticket.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">{ticket.company_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground">{ticket.title}</td>
                      <td className="p-4 text-sm text-blue-700 dark:text-blue-400 font-medium">{ticket.ticket_number}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-4">
                        <Select
                          value={ticket.status}
                          onValueChange={(status) => updateStatusMutation.mutate({ ticketId: ticket.id, status })}
                        >
                          <SelectTrigger className="w-32 h-8 border-0 bg-transparent p-0">
                            {getStatusBadge(ticket.status)}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aberto">Aberto</SelectItem>
                            <SelectItem value="em_andamento">Em Andamento</SelectItem>
                            <SelectItem value="resolvido">Resolvido</SelectItem>
                            <SelectItem value="fechado">Fechado</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTicket(ticket)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Nenhum ticket encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Chat Sheet */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>{selectedTicket?.title}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)}>
                <X className="w-4 h-4" />
              </Button>
            </SheetTitle>
            <div className="text-sm text-muted-foreground">
              <p>{selectedTicket?.user_name} • {selectedTicket?.user_email}</p>
              <p>{selectedTicket?.company_name} • #{selectedTicket?.ticket_number}</p>
            </div>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100vh-200px)] mt-4">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {/* Initial description */}
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg bg-secondary text-foreground">
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket?.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedTicket && new Date(selectedTicket.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                {messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.is_admin
                          ? "bg-[#273d60] text-white"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {msg.is_admin && (
                        <p className="text-xs font-medium text-blue-200 mb-1">Admin</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.is_admin ? "text-blue-200" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Responder como administrador..."
                className="resize-none bg-secondary border-0"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="self-end bg-[#273d60] hover:bg-[#273d60]/90 text-white"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};