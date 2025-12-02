import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Crown, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SUBSCRIPTION_TIERS = [
  { name: "Grátis", limit: 5, price: 0, priceId: "free", description: "Ideal para testes" },
  { name: "Básico", limit: 20, price: 54.90, priceId: "price_1SZgF8HRTD5WvpxjUn1AZydj", description: "Para pequenas empresas" },
  { name: "Profissional", limit: 50, price: 89.90, priceId: "price_1SZgFeHRTD5Wvpxju4vtwaM0", description: "Para empresas em crescimento" },
  { name: "Empresarial", limit: 100, price: 159.90, priceId: "price_1SZgFqHRTD5WvpxjHpfPyEEb", description: "Para empresas estabelecidas" },
  { name: "Premium", limit: 150, price: 209.90, priceId: "price_1SZgG2HRTD5WvpxjzJMpIc9C", description: "Para grandes volumes" },
  { name: "Enterprise", limit: 9999, price: 289.90, priceId: "price_1SZgGCHRTD5Wvpxjj79RSMXX", description: "Documentos ilimitados" },
];

export function SubscriptionTab() {
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<{ current: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(true);

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
      // Get user email and organization name
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("Email do usuário não encontrado");
      }

      const { data: companyData } = await supabase
        .from("company_settings")
        .select("company_name")
        .eq("user_id", user.id)
        .single();

      const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
        body: {
          priceId: tier.priceId,
          tierName: tier.name,
          documentLimit: tier.limit,
          email: user.email,
          organizationName: companyData?.company_name || "Organização",
          userId: user.id,
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
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-1">
                <Progress value={usagePercent} className="h-2 bg-gray-300" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Uso de Documentos</span>
                  <span className="font-bold text-primary">
                    {usage?.current || 0} / {subscription.document_limit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
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
                    `Fazer Upgrade para ${nextTier.name} - R$ ${nextTier.price.toFixed(2).replace('.', ',')} / mês`
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
              <div className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory max-w-full">
            {SUBSCRIPTION_TIERS.filter((t) => 
              t.limit > subscription.document_limit && t.priceId !== "free"
            ).map((tier) => (
              <Card key={tier.name} className="relative flex-shrink-0 w-[320px] snap-start pt-8">
                <CardHeader>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold">R$ {tier.price.toFixed(2).replace('.', ',')} <span className="text-lg font-normal text-muted-foreground">/ mês</span></p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>
                        {tier.limit >= 1000 ? "Documentos/envelopes ilimitados" : `Até ${tier.limit} documentos/envelopes`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Assinatura digital ICP-Brasil</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Notificações por email/WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Geolocalização da assinatura</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Face ID</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Eon Drive</span>
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

        {/* Comparison Table */}
        <Collapsible open={isComparisonOpen} onOpenChange={setIsComparisonOpen} className="space-y-2">
          <CollapsibleContent>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <h3 className="text-lg font-semibold">Comparativo de Planos</h3>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isComparisonOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Recurso</TableHead>
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <TableHead key={tier.name} className="text-center">{tier.name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Preço/mês</TableCell>
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <TableCell key={tier.name} className="text-center font-bold">
                            {tier.price === 0 ? "Grátis" : `R$ ${tier.price.toFixed(2).replace('.', ',')}`}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Documentos/mês</TableCell>
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <TableCell key={tier.name} className="text-center">
                            {tier.limit >= 1000 ? "Ilimitado" : tier.limit}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Assinatura ICP-Brasil</TableCell>
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <TableCell key={tier.name} className="text-center">
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Email/WhatsApp</TableCell>
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <TableCell key={tier.name} className="text-center">
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Geolocalização</TableCell>
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <TableCell key={tier.name} className="text-center">
                            {tier.priceId === "free" ? (
                              <X className="h-4 w-4 text-gray-400 mx-auto" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Eon Drive</TableCell>
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <TableCell key={tier.name} className="text-center">
                            {tier.priceId === "free" ? (
                              <X className="h-4 w-4 text-gray-400 mx-auto" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Face ID</TableCell>
                        {SUBSCRIPTION_TIERS.map((tier, index) => (
                          <TableCell key={tier.name} className="text-center">
                            {tier.priceId === "free" || index === 1 ? (
                              <X className="h-4 w-4 text-gray-400 mx-auto" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* FAQ */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Perguntas Frequentes</h3>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Como funciona a assinatura digital?</AccordionTrigger>
              <AccordionContent>
                A assinatura digital utiliza certificados ICP-Brasil para garantir autenticidade, integridade e validade jurídica aos documentos assinados. Cada assinatura é registrada com dados do signatário, IP, localização e timestamp.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Posso fazer upgrade do meu plano?</AccordionTrigger>
              <AccordionContent>
                Sim, você pode fazer upgrade a qualquer momento. O valor será cobrado proporcionalmente ao período restante do mês e o limite de documentos será atualizado imediatamente.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>O que acontece se eu atingir o limite mensal?</AccordionTrigger>
              <AccordionContent>
                Ao atingir o limite mensal de documentos, você será notificado e precisará fazer upgrade para o próximo plano ou aguardar o início do próximo mês para criar novos documentos.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Os documentos assinados têm validade jurídica?</AccordionTrigger>
              <AccordionContent>
                Sim, todas as assinaturas realizadas através do Eon Sign utilizam certificação ICP-Brasil e possuem plena validade jurídica conforme a MP 2.200-2/2001 e Lei 14.063/2020.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Posso cancelar minha assinatura?</AccordionTrigger>
              <AccordionContent>
                Sim, você pode cancelar sua assinatura a qualquer momento através do portal de gerenciamento. O acesso aos recursos pagos permanecerá ativo até o final do período já pago.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    );
  }

  // User on free tier - show all paid tiers
  return (
    <div className="space-y-6">
      {usage && (
        <>
          <Card className="bg-gray-100 border-0 max-w-sm">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-gray-600 mb-1">
                Você está no plano <strong>GRÁTIS</strong>
              </p>
              <div className="space-y-1">
                <Progress value={(usage.current / 5) * 100} className="h-2 bg-gray-300" />
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Consumo</span>
                  <span className="font-bold text-gray-600">
                    {usage.current} / 5
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-start">
            <Button
              onClick={handleManageSubscription}
              className="rounded-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:from-[#273d60] hover:to-[#001f3f] px-6"
            >
              Extrato de Pagamentos
            </Button>
          </div>
        </>
      )}

      <div className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory max-w-full">
        {SUBSCRIPTION_TIERS.map((tier, index) => {
          const isRecommended = index === 2; // Professional tier
          return (
            <Card
              key={tier.name}
              className={`relative flex-shrink-0 w-[320px] snap-start pt-8 ${isRecommended ? "border-primary shadow-lg" : ""}`}
            >
              {isRecommended && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary whitespace-nowrap">Recomendado</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold">
                    {tier.price === 0 ? "Grátis" : (
                      <>
                        R$ {tier.price.toFixed(2).replace('.', ',')} <span className="text-lg font-normal text-muted-foreground">/ mês</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>
                      {tier.limit >= 1000 ? "Documentos/envelopes ilimitados" : `Até ${tier.limit} documentos/envelopes`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Assinatura digital ICP-Brasil</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Notificações por email/WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {tier.priceId === "free" ? (
                      <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    )}
                    <span className={tier.priceId === "free" ? "text-gray-400 line-through" : ""}>
                      Geolocalização da assinatura
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {tier.priceId === "free" ? (
                      <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    )}
                    <span className={tier.priceId === "free" ? "text-gray-400 line-through" : ""}>
                      Face ID
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {tier.priceId === "free" ? (
                      <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    )}
                    <span className={tier.priceId === "free" ? "text-gray-400 line-through" : ""}>
                      Eon Drive
                    </span>
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

      {/* Comparison Table */}
      <Collapsible open={isComparisonOpen} onOpenChange={setIsComparisonOpen} className="space-y-2">
        <CollapsibleContent>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <h3 className="text-lg font-semibold">Comparativo de Planos</h3>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isComparisonOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Recurso</TableHead>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <TableHead key={tier.name} className="text-center">{tier.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Preço/mês</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <TableCell key={tier.name} className="text-center font-bold">
                          {tier.price === 0 ? "Grátis" : `R$ ${tier.price.toFixed(2).replace('.', ',')}`}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Documentos/mês</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <TableCell key={tier.name} className="text-center">
                          {tier.limit >= 1000 ? "Ilimitado" : tier.limit}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Assinatura ICP-Brasil</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <TableCell key={tier.name} className="text-center">
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Email/WhatsApp</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <TableCell key={tier.name} className="text-center">
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Geolocalização</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <TableCell key={tier.name} className="text-center">
                          {tier.priceId === "free" ? (
                            <X className="h-4 w-4 text-gray-400 mx-auto" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Eon Drive</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <TableCell key={tier.name} className="text-center">
                          {tier.priceId === "free" ? (
                            <X className="h-4 w-4 text-gray-400 mx-auto" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Face ID</TableCell>
                      {SUBSCRIPTION_TIERS.map((tier, index) => (
                        <TableCell key={tier.name} className="text-center">
                          {tier.priceId === "free" || index === 1 ? (
                            <X className="h-4 w-4 text-gray-400 mx-auto" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* FAQ */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Perguntas Frequentes</h3>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Como funciona a assinatura digital?</AccordionTrigger>
            <AccordionContent>
              A assinatura digital utiliza certificados ICP-Brasil para garantir autenticidade, integridade e validade jurídica aos documentos assinados. Cada assinatura é registrada com dados do signatário, IP, localização e timestamp.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Posso fazer upgrade do meu plano?</AccordionTrigger>
            <AccordionContent>
              Sim, você pode fazer upgrade a qualquer momento. O valor será cobrado proporcionalmente ao período restante do mês e o limite de documentos será atualizado imediatamente.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>O que acontece se eu atingir o limite mensal?</AccordionTrigger>
            <AccordionContent>
              Ao atingir o limite mensal de documentos, você será notificado e precisará fazer upgrade para o próximo plano ou aguardar o início do próximo mês para criar novos documentos.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>Os documentos assinados têm validade jurídica?</AccordionTrigger>
            <AccordionContent>
              Sim, todas as assinaturas realizadas através do Eon Sign utilizam certificação ICP-Brasil e possuem plena validade jurídica conforme a MP 2.200-2/2001 e Lei 14.063/2020.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-5">
            <AccordionTrigger>Posso cancelar minha assinatura?</AccordionTrigger>
            <AccordionContent>
              Sim, você pode cancelar sua assinatura a qualquer momento através do portal de gerenciamento. O acesso aos recursos pagos permanecerá ativo até o final do período já pago.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
