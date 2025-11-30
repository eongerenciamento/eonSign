import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const checkoutSchema = z.object({
  organizationName: z.string().min(3, "Nome da organização deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
});

interface PlanCheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plan: {
    id: string;
    name: string;
    limit: number;
    price: number;
    priceId: string;
  };
}

export function PlanCheckoutDialog({ isOpen, onClose, plan }: PlanCheckoutDialogProps) {
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = checkoutSchema.safeParse({ organizationName, email });
      
      if (!result.success) {
        const firstError = result.error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (plan.price === 0) {
        // Plano gratuito - criar conta direto
        const { data, error } = await supabase.functions.invoke('create-free-account', {
          body: {
            email,
            organizationName,
          }
        });

        if (error) throw error;

        toast({
          title: "Conta criada!",
          description: "Verifique seu email para acessar sua senha temporária.",
        });
        
        navigate('/auth?success=true');
      } else {
        // Plano pago - ir para checkout Stripe
        const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
          body: {
            priceId: plan.priceId,
            tierName: plan.name,
            documentLimit: plan.limit,
            email,
            organizationName,
          }
        });

        if (error) throw error;

        if (data?.url) {
          window.open(data.url, '_blank');
          toast({
            title: "Redirecionando para pagamento",
            description: "Complete o pagamento para criar sua conta.",
          });
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao processar solicitação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar conta - Plano {plan.name}</DialogTitle>
          <DialogDescription>
            {plan.price === 0 
              ? "Preencha os dados abaixo para criar sua conta gratuita."
              : "Preencha os dados abaixo para prosseguir para o pagamento."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationName">Nome da Organização</Label>
            <Input
              id="organizationName"
              placeholder="Minha Empresa LTDA"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Processando..." : plan.price === 0 ? "Criar Conta Grátis" : "Prosseguir para Pagamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
