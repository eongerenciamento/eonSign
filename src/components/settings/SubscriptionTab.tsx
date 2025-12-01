import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Crown, Loader2 } from "lucide-react";

const SUBSCRIPTION_TIERS = [
  { name: "Grátis", limit: 5, price: 0, priceId: "free", description: "Ideal para testes" },
  { name: "Básico", limit: 20, price: 59, priceId: "price_1SZBDZHRTD5WvpxjeKMhFcSK", description: "Para pequenas empresas" },
  { name: "Profissional", limit: 50, price: 99, priceId: "price_1SZBEAHRTD5Wvpxj0pcztkPt", description: "Para empresas em crescimento" },
  { name: "Empresarial", limit: 100, price: 159, priceId: "price_1SZBEOHRTD5WvpxjFsV37k0o", description: "Para empresas estabelecidas" },
  { name: "Premium", limit: 500, price: 499, priceId: "price_1SZBEdHRTD5Wvpxj46hhdp54", description: "Para grandes volumes" },
  { name: "Enterprise", limit: 1000, price: 899, priceId: "price_1SZBEsHRTD5Wvpxj6t1lc01Z", description: "Documentos ilimitados" },
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

  const handleUpgrade = async (tier: typeof SUBSCRIPTION_TIERS[0]) => {
    if (tier.priceId === "free") {
      toast.info("Você já está no plano gratuito");
      return;
    }

    setProcessingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
        body: {
          priceId: tier.priceId,
          tierName: tier.name,
          documentLimit: tier.limit,
        },
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

  // User has active tier
  if (subscription && subscription.status === "active") {
    const usagePercent = usage ? (usage.current / subscription.document_limit) * 100 : 0;
    const currentTierIndex = SUBSCRIPTION_TIERS.findIndex(t => t.name === subscription.plan_name);
    const nextTier = currentTierIndex >= 0 && currentTierIndex < SUBSCRIPTION_TIERS.length - 1 
      ? SUBSCRIPTION_TIERS[currentTierIndex + 1] 
      : null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {subscription.plan_name}
                  {subscription.plan_name !== "Grátis" && <Crown className="h-5 w-5 text-yellow-500" />}
                </CardTitle>
                <CardDescription>Seu plano atual</CardDescription>
              </div>
              {getStatusBadge(subscription.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">Uso de Documentos</span>
                  <span className="font-bold text-primary">
                    {usage?.current || 0} / {subscription.document_limit}
                  </span>
                </div>
                <Progress value={usagePercent} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {usagePercent >= 80 ? (
                    <span className="text-yellow-600 font-medium">
                      Você está próximo do limite. Considere fazer upgrade.
                    </span>
                  ) : (
                    `Você usou ${usage?.current || 0} de ${subscription.document_limit} documentos disponíveis neste mês.`
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              {nextTier && (
                <Button
                  onClick={() => handleUpgrade(nextTier)}
                  disabled={processingCheckout}
                  className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white"
                >
                  {processingCheckout ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Fazer Upgrade para ${nextTier.name} - R$ ${nextTier.price}`
                  )}
                </Button>
              )}
              <Button
                onClick={handleManageSubscription}
                variant="outline"
                className="flex-1"
              >
                Extrato de Pagamentos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Show upgrade options */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Planos Disponíveis para Upgrade</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SUBSCRIPTION_TIERS.filter((t) => 
              t.limit > subscription.document_limit && t.priceId !== "free"
            ).map((tier) => (
              <Card key={tier.name} className="relative">
                <CardHeader>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold">R$ {tier.price}</p>
                    <p className="text-sm text-muted-foreground">por mês</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600" />
                    <span>
                      {tier.limit >= 1000 ? "Documentos ilimitados" : `Até ${tier.limit} documentos/mês`}
                    </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUpgrade(tier)}
                    disabled={processingCheckout}
                    className="w-full bg-[#273d60] hover:bg-[#273d60]/90 text-white"
                  >
                    {processingCheckout ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Fazer Upgrade"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // User on free tier - show all paid tiers
  return (
    <div className="space-y-6">
      {usage && (
        <Card className="bg-gray-100 border-0">
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-gray-600 mb-2">
              Você está no plano <strong>GRÁTIS</strong>
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-600">Consumo</span>
                <span className="font-bold text-gray-600">
                  {usage.current} / 5
                </span>
              </div>
              <Progress value={(usage.current / 5) * 100} className="h-3 bg-gray-300" />
            </div>
            <Button
              onClick={handleManageSubscription}
              className="w-full rounded-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:from-[#273d60] hover:to-[#001f3f]"
            >
              Extrato de Pagamentos
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUBSCRIPTION_TIERS.map((tier, index) => {
          const isRecommended = index === 2; // Professional tier
          return (
            <Card
              key={tier.name}
              className={`relative ${isRecommended ? "border-primary shadow-lg" : ""}`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Recomendado</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold">
                    {tier.price === 0 ? "Grátis" : `R$ ${tier.price}`}
                  </p>
                  {tier.price > 0 && <p className="text-sm text-muted-foreground">por mês</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>
                      {tier.limit >= 1000 ? "Documentos ilimitados" : `Até ${tier.limit} documentos/mês`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Assinatura digital ICP-Brasil</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Notificações por email e WhatsApp</span>
                  </div>
                </div>
                <Button
                  onClick={() => handleUpgrade(tier)}
                  disabled={processingCheckout || tier.priceId === "free"}
                  className={tier.priceId === "free" ? "w-full" : "w-full bg-[#273d60] hover:bg-[#273d60]/90 text-white"}
                  variant={tier.priceId === "free" ? "outline" : undefined}
                >
                  {processingCheckout ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : tier.priceId === "free" ? (
                    "Plano Atual"
                  ) : (
                    "Fazer Upgrade"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
