import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Check, X, RotateCcw, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
  rating?: number | null;
  rating_comment?: string | null;
  closed_at?: string | null;
  reopened_at?: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  message_type?: string;
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
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      // Call the Edge Function to send message and trigger webhook
      const { data, error } = await supabase.functions.invoke('send-ticket-message', {
        body: {
          ticketId: ticket.id,
          message: message.trim()
        }
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

  const handleCloseTicket = async () => {
    if (!ticket || rating === 0) {
      toast.error("Por favor, selecione uma avaliação");
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      // Update ticket with rating and status
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({ 
          status: 'resolvido',
          rating: rating,
          rating_comment: ratingComment.trim() || null,
          closed_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (ticketError) throw ticketError;

      // Insert closed event message
      const { error: closedMsgError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          user_id: session.user.id,
          message: 'Ticket encerrado',
          is_admin: false,
          message_type: 'closed'
        });

      if (closedMsgError) console.error("Error inserting closed message:", closedMsgError);

      // Insert rating event message
      const { error: ratingMsgError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          user_id: session.user.id,
          message: JSON.stringify({ rating, comment: ratingComment.trim() || null }),
          is_admin: false,
          message_type: 'rating'
        });

      if (ratingMsgError) console.error("Error inserting rating message:", ratingMsgError);
      
      toast.success("Ticket encerrado com sucesso");
      setShowRatingDialog(false);
      setRating(0);
      setRatingComment("");
      refetchMessages();
      onTicketUpdated?.();
    } catch (error) {
      console.error("Erro ao encerrar ticket:", error);
      toast.error("Erro ao encerrar ticket");
    }
  };

  const handleReopenTicket = async () => {
    if (!ticket) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      // Update ticket status
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({ 
          status: 'aberto',
          reopened_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (ticketError) throw ticketError;

      // Insert reopened event message
      const { error: reopenMsgError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          user_id: session.user.id,
          message: 'Ticket reaberto',
          is_admin: false,
          message_type: 'reopened'
        });

      if (reopenMsgError) console.error("Error inserting reopened message:", reopenMsgError);
      
      toast.success("Ticket reaberto");
      refetchMessages();
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

  const renderStars = (count: number, interactive: boolean = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= (interactive ? (hoveredStar || rating) : count)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer transition-colors' : ''}`}
            onClick={interactive ? () => setRating(star) : undefined}
            onMouseEnter={interactive ? () => setHoveredStar(star) : undefined}
            onMouseLeave={interactive ? () => setHoveredStar(0) : undefined}
          />
        ))}
      </div>
    );
  };

  const renderSystemMessage = (msg: TicketMessage) => {
    const messageDate = format(new Date(msg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    if (msg.message_type === 'closed') {
      return (
        <div key={msg.id} className="flex justify-center my-4">
          <div className="bg-secondary rounded-lg px-4 py-3 text-center max-w-[280px]">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Ticket encerrado</span>
            </div>
            <p className="text-xs text-muted-foreground">{messageDate}</p>
          </div>
        </div>
      );
    }
    
    if (msg.message_type === 'rating') {
      try {
        const ratingData = JSON.parse(msg.message);
        return (
          <div key={msg.id} className="flex justify-center my-4">
            <div className="bg-secondary rounded-lg px-4 py-3 text-center max-w-[280px]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium text-muted-foreground">Avaliação enviada</span>
              </div>
              <div className="flex justify-center mb-2">
                {renderStars(ratingData.rating)}
              </div>
              {ratingData.comment && (
                <p className="text-sm text-muted-foreground italic">"{ratingData.comment}"</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">{messageDate}</p>
            </div>
          </div>
        );
      } catch {
        return null;
      }
    }
    
    if (msg.message_type === 'reopened') {
      return (
        <div key={msg.id} className="flex justify-center my-4">
          <div className="bg-secondary rounded-lg px-4 py-3 text-center max-w-[280px]">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Ticket reaberto</span>
            </div>
            <p className="text-xs text-muted-foreground">{messageDate}</p>
          </div>
        </div>
      );
    }
    
    return null;
  };

  const renderChatMessage = (msg: TicketMessage) => {
    // System messages (events)
    if (msg.message_type && msg.message_type !== 'message') {
      return renderSystemMessage(msg);
    }
    
    // Regular chat messages
    return (
      <div
        key={msg.id}
        className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
      >
        <div
          className={`max-w-[80%] rounded-lg p-3 ${
            msg.is_admin
              ? 'bg-blue-500 text-white'
              : 'bg-emerald-500 text-white'
          }`}
        >
          <p className="text-sm">{msg.message}</p>
          <p className={`text-xs mt-1 ${msg.is_admin ? 'text-blue-100' : 'text-emerald-100'}`}>
            {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
    );
  };

  const isTicketClosed = ticket?.status === 'resolvido' || ticket?.status === 'fechado';

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
                  size="sm"
                  onClick={() => setShowRatingDialog(true)}
                  className="rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Encerrar chamado
                </Button>
              )}
              {isTicketClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReopenTicket}
                  className="rounded-full text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reabrir
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
                messages.map((msg) => renderChatMessage(msg))
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
                Este ticket foi encerrado. Clique em "Reabrir" para continuar a conversa.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Rating Dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <button
            onClick={() => setShowRatingDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
          <DialogHeader>
            <DialogTitle>Como foi o atendimento?</DialogTitle>
            <DialogDescription>
              Sua avaliação nos ajuda a melhorar nosso suporte.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex justify-center mb-4">
              {renderStars(rating, true)}
            </div>
            <Textarea
              placeholder="Deixe um comentário (opcional)"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setShowRatingDialog(false);
                setRating(0);
                setRatingComment("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCloseTicket}
              disabled={rating === 0}
              className="bg-[#273d60] hover:bg-[#273d60]/90"
            >
              Enviar avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
