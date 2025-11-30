import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { XCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function useWhatsAppFailureNotifications() {
  useEffect(() => {
    const setupRealtimeListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('whatsapp_failures')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'whatsapp_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const message = payload.new;
            if (message.status === 'failed' || message.status === 'undelivered') {
              const errorDetail = message.error_message 
                ? ` - ${message.error_message}` 
                : '';
              
              toast({
                title: "❌ Falha no envio de WhatsApp",
                description: (
                  <div className="space-y-2">
                    <p>Não foi possível enviar mensagem para <strong>{message.recipient_name}</strong></p>
                    <p className="text-xs text-muted-foreground">{message.recipient_phone}{errorDetail}</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.location.href = '/configuracoes?tab=history&subtab=whatsapp'}
                      className="mt-2"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Ver Histórico
                    </Button>
                  </div>
                ),
                variant: "destructive",
                duration: 10000,
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'whatsapp_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const message = payload.new;
            const oldMessage = payload.old;
            
            // Detectar mudança para status de falha
            if (
              (message.status === 'failed' || message.status === 'undelivered') &&
              oldMessage.status !== 'failed' &&
              oldMessage.status !== 'undelivered'
            ) {
              const errorDetail = message.error_message 
                ? ` - ${message.error_message}` 
                : '';
              
              toast({
                title: "❌ Falha na entrega de WhatsApp",
                description: (
                  <div className="space-y-2">
                    <p>Mensagem para <strong>{message.recipient_name}</strong> não foi entregue</p>
                    <p className="text-xs text-muted-foreground">{message.recipient_phone}{errorDetail}</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.location.href = '/configuracoes?tab=history&subtab=whatsapp'}
                      className="mt-2"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Ver Histórico
                    </Button>
                  </div>
                ),
                variant: "destructive",
                duration: 10000,
              });
            }

            // Notificação de sucesso para mensagens lidas
            if (message.status === 'read' && oldMessage.status !== 'read') {
              toast({
                title: "✅ Mensagem lida",
                description: `${message.recipient_name} leu a mensagem WhatsApp`,
                duration: 4000,
              });
            }

            // Notificação de entrega bem-sucedida
            if (message.status === 'delivered' && oldMessage.status === 'sent') {
              toast({
                title: "✓ Mensagem entregue",
                description: `WhatsApp entregue para ${message.recipient_name}`,
                duration: 3000,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtimeListener();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);
}
