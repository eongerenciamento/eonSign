import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Check, X, RotateCcw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  ticket_number: string;
  created_at: string;
  user_id: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface TicketChatSheetProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketUpdated?: () => void;
}

export function TicketChatSheet({ ticket, open, onOpenChange, onTicketUpdated }: TicketChatSheetProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Extract category and priority from description
  const categoryMatch = ticket?.description.match(/Categoria: ([^\n]+)/);
  const priorityMatch = ticket?.description.match(/Prioridade: ([^\n]+)/);
  const category = categoryMatch ? categoryMatch[1] : '-';
  const priority = priorityMatch ? priorityMatch[1] : '-';
  
  // Extract actual description (after the metadata)
  const descriptionParts = ticket?.description.split('\n\n');
  const actualDescription = descriptionParts && descriptionParts.length > 1 
    ? descriptionParts.slice(1).join('\n\n').replace(/\nAnexos: \d+$/, '')
    : ticket?.description || '';

  // Fetch messages
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['ticket-messages', ticket?.id],
    queryFn: async () => {
      if (!ticket) return [];
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as TicketMessage[];
    },
    enabled: !!ticket && open,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !ticket) return;
    
    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: message.trim(),
          is_admin: false,
        });

      if (error) throw error;
      
      setMessage("");
      refetchMessages();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseTicket = async (resolved: boolean) => {
    if (!ticket) return;
    
    try {
      const newStatus = resolved ? 'resolvido' : 'fechado';
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id);

      if (error) throw error;
      
      toast.success(resolved ? "Ticket marcado como resolvido" : "Ticket encerrado");
      setShowCloseDialog(false);
      onOpenChange(false);
      onTicketUpdated?.();
    } catch (error) {
      console.error("Erro ao encerrar ticket:", error);
      toast.error("Erro ao encerrar ticket");
    }
  };

  const handleReopenTicket = async () => {
    if (!ticket) return;
    
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'aberto' })
        .eq('id', ticket.id);

      if (error) throw error;
      
      toast.success("Ticket reaberto");
      onTicketUpdated?.();
    } catch (error) {
      console.error("Erro ao reabrir ticket:", error);
      toast.error("Erro ao reabrir ticket");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { border: string; text: string; label: string }> = {
      aberto: { border: 'border-red-500', text: 'text-red-500', label: 'Aberto' },
      em_andamento: { border: 'border-yellow-500', text: 'text-yellow-500', label: 'Em Andamento' },
      resolvido: { border: 'border-green-500', text: 'text-green-500', label: 'Resolvido' },
      fechado: { border: 'border-gray-500', text: 'text-gray-500', label: 'Fechado' },
    };
    const config = statusConfig[status] || statusConfig.aberto;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.border} ${config.text} bg-transparent`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { bg: string; text: string }> = {
      baixa: { bg: 'bg-gray-100', text: 'text-gray-700' },
      media: { bg: 'bg-blue-100', text: 'text-blue-700' },
      média: { bg: 'bg-blue-100', text: 'text-blue-700' },
      alta: { bg: 'bg-orange-100', text: 'text-orange-700' },
      urgente: { bg: 'bg-red-100', text: 'text-red-700' },
    };
    const config = priorityConfig[priority.toLowerCase()] || priorityConfig.media;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${config.bg} ${config.text}`}>
        {priority}
      </span>
    );
  };

  const isTicketClosed = ticket?.status === 'resolvido' || ticket?.status === 'fechado';
  const canReopen = ticket?.status === 'fechado';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col rounded-l-2xl">
          {/* Header */}
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold">
                Ticket {ticket?.ticket_number}
              </SheetTitle>
              {!isTicketClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCloseDialog(true)}
                  className="text-gray-600 border-gray-300"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Encerrar chamado
                </Button>
              )}
              {canReopen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReopenTicket}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reabrir ticket
                </Button>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              {ticket && getStatusBadge(ticket.status)}
              {getPriorityBadge(priority)}
            </div>
          </SheetHeader>

          {/* Description Card */}
          <div className="p-4 border-b">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900 mb-1">{ticket?.title}</p>
              <p className="text-sm text-gray-600">{actualDescription}</p>
            </div>
          </div>

          {/* Chat Area */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages && messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.is_admin
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.is_admin ? 'text-gray-500' : 'text-blue-100'}`}>
                        {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-gray-500">
                  Nenhuma mensagem ainda. Inicie a conversa!
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          {!isTicketClosed && (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSending}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isSending}
                  className="bg-[#273d60] hover:bg-[#273d60]/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {isTicketClosed && (
            <div className="p-4 border-t bg-gray-50">
              <p className="text-center text-sm text-gray-500">
                Este ticket foi encerrado.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Close Ticket Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Encerrar chamado</DialogTitle>
            <DialogDescription>
              O problema foi resolvido?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleCloseTicket(false)}
              className="flex-1 sm:flex-none"
            >
              <X className="w-4 h-4 mr-2" />
              Não foi resolvido
            </Button>
            <Button
              onClick={() => handleCloseTicket(true)}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Sim, resolvido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
