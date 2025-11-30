import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Crown, Loader2 } from "lucide-react";

const STRIPE_PRICE_ID = "price_1SWhQIHRTD5WvpxjPvRHBY18";

const PRICING_TIERS = [
  { range: "0-5", price: 0, description: "Grátis até 5 documentos" },
  { range: "6-50", price: 59, description: "De 6 a 50 documentos" },
  { range: "51-100", price: 99, description: "De 51 a 100 documentos" },
  { range: "101-200", price: 159, description: "De 101 a 200 documentos" },
  { range: "201-500", price: 499, description: "De 201 a 500 documentos" },
  { range: "501+", price: 899, description: "A partir de 501 documentos" },
];

export function SubscriptionTab() {
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<{ current: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load subscription
      const { data: subData } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setSubscription(subData);

      // Load usage
      const { data: limitData } = await supabase.functions.invoke("check-document-limit");
      if (limitData) {
        setUsage({ current: limitData.current, limit: limitData.limit });
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setProcessingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
        body: { priceId: STRIPE_PRICE_ID },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast.error(error.message || "Erro ao criar sessão de pagamento");
    } finally {
      setProcessingCheckout(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-portal");

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error opening portal:", error);
      toast.error(error.message || "Erro ao abrir portal de gerenciamento");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      active: { variant: "default", label: "Ativo" },
      trialing: { variant: "secondary", label: "Teste" },
      past_due: { variant: "destructive", label: "Vencido" },
      canceled: { variant: "destructive", label: "Cancelado" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User has active subscription
  if (subscription && subscription.status === "active") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Assinatura Ativa
                  <Crown className="h-5 w-5 text-yellow-500" />
                </CardTitle>
                <CardDescription>Cobrança automática por volume mensal</CardDescription>
              </div>
              {getStatusBadge(subscription.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Documentos este mês</span>
                  <span className="font-medium">{usage?.current || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cobrança automática conforme o volume usado
                </p>
              </div>

              {subscription.current_period_end && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Próxima cobrança</span>
                  <span className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}

              {subscription.cancel_at_period_end && (
                <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                  Sua assinatura será cancelada ao final do período atual
                </div>
              )}
            </div>

            <Button
              onClick={handleManageSubscription}
              className="w-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white"
            >
              Gerenciar Assinatura
            </Button>
          </CardContent>
        </Card>

        {/* Pricing tiers info */}
        <Card>
          <CardHeader>
            <CardTitle>Tabela de Preços por Volume</CardTitle>
            <CardDescription>Você é cobrado automaticamente conforme o uso mensal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {PRICING_TIERS.map((tier) => (
                <div key={tier.range} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm font-medium">{tier.description}</span>
                  <span className="text-sm text-muted-foreground">
                    {tier.price === 0 ? "Grátis" : `R$ ${tier.price}/mês`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has no subscription - show pricing info
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assinatura Eon Sign</CardTitle>
          <CardDescription>
            Cobrança automática por volume mensal de documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Tabela de Preços</h3>
            <div className="space-y-2">
              {PRICING_TIERS.map((tier) => (
                <div key={tier.range} className="flex justify-between items-center py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{tier.description}</p>
                    <p className="text-sm text-muted-foreground">{tier.range} documentos/mês</p>
                  </div>
                  <span className="text-lg font-bold">
                    {tier.price === 0 ? "Grátis" : `R$ ${tier.price}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span>Assinatura digital ICP-Brasil</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span>Notificações por email e WhatsApp</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span>Cobrança automática conforme o uso</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span>Sem limites de documentos</span>
            </div>
          </div>

          <Button
            onClick={handleSubscribe}
            disabled={processingCheckout}
            className="w-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white"
            size="lg"
          >
            {processingCheckout ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Assinar Agora"
            )}
          </Button>
        </CardContent>
      </Card>

      {usage && usage.current > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-800">
              Você criou <strong>{usage.current} documentos</strong> este mês.
              <br />
              Assine para continuar usando o Eon Sign sem limites.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
