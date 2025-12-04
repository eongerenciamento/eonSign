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
const SUBSCRIPTION_TIERS = [{
  name: "Grátis",
  limit: 5,
  price: 0,
  priceId: "free",
  description: "Ideal para testes"
}, {
  name: "Básico",
  limit: 20,
  price: 54.90,
  priceId: "price_1SZgF8HRTD5WvpxjUn1AZydj",
  description: "Para pequenas empresas"
}, {
  name: "Profissional",
  limit: 50,
  price: 89.90,
  priceId: "price_1SZgFeHRTD5Wvpxju4vtwaM0",
  description: "Para empresas em crescimento"
}, {
  name: "Empresarial",
  limit: 100,
  price: 159.90,
  priceId: "price_1SZgFqHRTD5WvpxjHpfPyEEb",
  description: "Para empresas estabelecidas"
}, {
  name: "Premium",
  limit: 150,
  price: 209.90,
  priceId: "price_1SZgG2HRTD5WvpxjzJMpIc9C",
  description: "Para grandes volumes"
}, {
  name: "Enterprise",
  limit: 200,
  price: 289.90,
  priceId: "price_1SZgGCHRTD5Wvpxjj79RSMXX",
  description: "Documentos ilimitados"
}];
export function SubscriptionTab() {
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<{
    current: number;
    limit: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(true);
  useEffect(() => {
    loadSubscriptionData();
  }, []);
  const loadSubscriptionData = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Load subscription
      const {
        data: subData
      } = await supabase.from("user_subscriptions").select("*").eq("user_id", user.id).single();
      setSubscription(subData);

      // Load usage
      const {
        data: limitData
      } = await supabase.functions.invoke("check-document-limit");
      if (limitData) {
        setUsage({
          current: limitData.current,
          limit: limitData.limit
        });
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("Email do usuário não encontrado");
      }
      const {
        data: companyData
      } = await supabase.from("company_settings").select("company_name").eq("user_id", user.id).single();
      const {
        data,
        error
      } = await supabase.functions.invoke("create-stripe-checkout", {
        body: {
          priceId: tier.priceId,
          tierName: tier.name,
          documentLimit: tier.limit,
          email: user.email,
          organizationName: companyData?.company_name || "Organização",
          userId: user.id
        }
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
      const {
        data,
        error
      } = await supabase.functions.invoke("create-stripe-portal");
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
    const variants: Record<string, {
      variant: "default" | "secondary" | "destructive";
      label: string;
    }> = {
      active: {
        variant: "default",
        label: "Ativo"
      },
      trialing: {
        variant: "secondary",
        label: "Teste"
      },
      past_due: {
        variant: "destructive",
        label: "Vencido"
      },
      canceled: {
        variant: "destructive",
        label: "Cancelado"
      }
    };
    const config = variants[status] || {
      variant: "secondary",
      label: status
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  if (loading) {
    return <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }

  // User has active tier
  if (subscription && subscription.status === "active") {
    const usagePercent = usage ? usage.current / subscription.document_limit * 100 : 0;
    return <div className="space-y-10">
        {/* Grid com 4 cards de informação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {/* Card 1: Plano Atual */}
          <Card className="bg-gray-100 border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Plano Atual</p>
                {getStatusBadge(subscription.status)}
              </div>
              <p className="text-xl font-bold text-gray-900 mb-1">
                {subscription.plan_name}
              </p>
              <Button onClick={handleManageSubscription} variant="link" className="p-0 h-auto text-xs text-gray-600 hover:text-gray-900">
                Extrato de Pagamentos
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Valor */}
          <Card className="bg-gray-100 border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-2">Valor</p>
              <p className="text-xl font-bold text-gray-900">
                {SUBSCRIPTION_TIERS.find(t => t.name === subscription?.plan_name)?.price ? `R$ ${SUBSCRIPTION_TIERS.find(t => t.name === subscription?.plan_name)?.price.toFixed(2).replace('.', ',')}` : "R$ 0,00"}
              </p>
              <p className="text-xs text-gray-500 mt-1">por mês</p>
            </CardContent>
          </Card>

          {/* Card 3: Data de Renovação */}
          <Card className="bg-gray-100 border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-2">Renovação</p>
              <p className="text-xl font-bold text-gray-900">
                {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }) : '-'}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Consumo */}
          <Card className="bg-gray-100 border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-2">Consumo</p>
              <p className="text-xl font-bold text-gray-900 mb-3">
                {usage?.current || 0} / {subscription.document_limit}
              </p>
              <Progress value={usagePercent} className="h-2 bg-gray-300" />
              {usagePercent >= 80 && <p className="text-xs text-yellow-600 font-medium mt-2">
                  Próximo do limite
                </p>}
            </CardContent>
          </Card>
        </div>

        {/* Show all plans */}
        <div className="pt-4">
          <h3 className="text-lg font-semibold mb-6">Planos Disponíveis</h3>
          <div className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory max-w-6xl mx-auto">
            {SUBSCRIPTION_TIERS.map((tier) => {
              const isCurrentPlan = tier.limit === subscription.document_limit;
              const isDowngrade = tier.limit < subscription.document_limit;
              const isUpgrade = tier.limit > subscription.document_limit;
              
              return (
                <Card key={tier.name} className={`relative flex-shrink-0 w-[320px] snap-start pt-8 ${isCurrentPlan ? "border-primary shadow-lg" : ""}`}>
                  {isCurrentPlan && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-primary whitespace-nowrap">Plano Atual</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold">
                        {tier.price === 0 ? "Grátis" : <>R$ {tier.price.toFixed(2).replace('.', ',')} <span className="text-lg font-normal text-muted-foreground">/ mês</span></>}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>
                          {tier.limit >= 1000 ? "Documentos / envelopes ilimitados" : <>Até <strong>{tier.limit}</strong> documentos / envelopes</>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>Usuários <strong>ilimitados</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>Assinatura digital ICP-Brasil</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>Notificações por email/WhatsApp</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                        <span className={tier.priceId === "free" ? "text-gray-400 line-through" : ""}>Geolocalização da assinatura</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                        <span className={tier.priceId === "free" ? "text-gray-400 line-through" : ""}>Eon Drive</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {tier.priceId === "free" || tier.name === "Básico" ? <X className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                        <span className={tier.priceId === "free" || tier.name === "Básico" ? "text-gray-400 line-through" : ""}>Biometria facial</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleUpgrade(tier)} 
                      disabled={processingCheckout || isCurrentPlan} 
                      className={isCurrentPlan ? "w-full" : "w-full bg-[#273d60] hover:bg-[#273d60]/90 text-white"}
                      variant={isCurrentPlan ? "outline" : undefined}
                    >
                      {processingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                        isCurrentPlan ? "Plano Atual" : 
                        isDowngrade ? "Downgrade" : 
                        "Fazer Upgrade"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="space-y-4 pt-4">
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => setIsComparisonOpen(!isComparisonOpen)} className="text-sm text-gray-600 hover:text-gray-900 hover:bg-transparent">
              {isComparisonOpen ? <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Ocultar Tabela Comparativa
                </> : <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Mostrar Tabela Comparativa
                </>}
            </Button>
          </div>
          
          <Collapsible open={isComparisonOpen} onOpenChange={setIsComparisonOpen}>
          <CollapsibleContent>
            <div className="overflow-x-auto scrollbar-hide rounded-lg max-w-6xl mx-auto border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-0">
                      <TableHead className="w-[200px] font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Recurso</TableHead>
                      {SUBSCRIPTION_TIERS.map(tier => <TableHead key={tier.name} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-[#273d60]">{tier.name}</span>
                            <span className="text-sm text-gray-500 font-normal">
                              {tier.price === 0 ? "Grátis" : tier.price.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  <TableRow className="bg-white border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Documentos / Envelopes</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                          {tier.limit}
                        </TableCell>)}
                    </TableRow>
                    <TableRow className="bg-gray-50 border-0">
                      <TableCell className="font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Usuários <strong>ilimitados</strong></TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        </TableCell>)}
                    </TableRow>
                    <TableRow className="bg-white border-0">
                      <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Assinatura digital<br className="md:hidden" />ICP-Brasil</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        </TableCell>)}
                    </TableRow>
                    <TableRow className="bg-white border-0">
                      <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Notificação por<br className="md:hidden" />E-mail / WhatsApp</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        </TableCell>)}
                    </TableRow>
                    <TableRow className="bg-gray-50 border-0">
                      <TableCell className="font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Geolocalização<br className="md:hidden" />da assinatura</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                          {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 mx-auto" /> : <Check className="h-4 w-4 text-green-600 mx-auto" />}
                        </TableCell>)}
                    </TableRow>
                    <TableRow className="bg-white border-0">
                      <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Eon Drive</TableCell>
                      {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                          {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 mx-auto" /> : <Check className="h-4 w-4 text-green-600 mx-auto" />}
                        </TableCell>)}
                    </TableRow>
                    <TableRow className="bg-gray-50 border-0">
                      <TableCell className="font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Biometria facial</TableCell>
                      {SUBSCRIPTION_TIERS.map((tier, index) => <TableCell key={tier.name} className="text-center">
                          {tier.priceId === "free" || index === 1 ? <X className="h-4 w-4 text-gray-400 mx-auto" /> : <Check className="h-4 w-4 text-green-600 mx-auto" />}
                        </TableCell>)}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* FAQ */}
        <div className="space-y-6 max-w-6xl mx-auto pt-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-700">Perguntas Frequentes</h2>
            <p className="text-gray-500">Tire suas dúvidas sobre nossos planos e funcionalidades</p>
          </div>
          <Card className="border">
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1" className="border-b">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Como funciona a contagem de documentos?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Cada documento enviado para assinatura conta como 1 documento no seu plano mensal. O contador é resetado no início de cada mês, permitindo que você utilize novamente todo o limite do seu plano.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className="border-b">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Posso mudar de plano depois?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Sim, você pode fazer upgrade para um plano superior a qualquer momento. O novo limite de documentos será aplicado imediatamente e você será cobrado proporcionalmente pelo período restante do mês.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className="border-b">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">As assinaturas digitais têm validade jurídica?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Sim, todas as assinaturas realizadas através do Eon Sign utilizam certificação ICP-Brasil e possuem plena validade jurídica conforme a MP 2.200-2/2001 e Lei 14.063/2020. Cada assinatura é registrada com timestamp, IP e geolocalização para máxima segurança.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4" className="border-b">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Posso cancelar minha assinatura?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Sim, você pode cancelar sua assinatura a qualquer momento através do portal de gerenciamento. O acesso aos recursos pagos permanecerá ativo até o final do período já pago, e você não será cobrado no próximo ciclo.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5" className="border-b">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Como funcionam as notificações por WhatsApp?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Todos os signatários recebem notificações automáticas por WhatsApp e e-mail quando um documento é enviado para assinatura e quando o processo é concluído. Isso garante que nenhuma assinatura seja perdida.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-6" className="border-b">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Existe período de teste gratuito?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Sim, o plano Grátis permite que você teste a plataforma com até 5 documentos por mês sem necessidade de cartão de crédito. É perfeito para conhecer todas as funcionalidades antes de escolher um plano pago.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-7" className="border-b">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Posso ter múltiplos usuários na minha conta?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Sim! Todos os planos incluem usuários ilimitados. O administrador da conta pode convidar outros membros da equipe através das Configurações &gt; Membros. Os membros convidados utilizam a assinatura da organização, sem necessidade de assinatura individual.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-8">
                  <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Os documentos ficam armazenados com segurança?</AccordionTrigger>
                  <AccordionContent className="text-left">
                    Sim, todos os documentos são armazenados com criptografia de ponta a ponta em servidores seguros. Apenas você e os signatários autorizados têm acesso aos documentos. Os documentos assinados ficam disponíveis permanentemente no Eon Drive.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>;
  }

  // User on free tier - show all paid tiers
  return <div className="space-y-10">
      {/* Grid com 4 cards de informação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {/* Card 1: Plano Atual */}
        <Card className="bg-gray-100 border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Plano Atual</p>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Ativo
              </Badge>
            </div>
            <p className="text-xl font-bold mb-1 text-gray-600">
              Grátis
            </p>
            <Button onClick={handleManageSubscription} variant="link" className="p-0 h-auto text-xs text-primary">
              Extrato de Pagamentos
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Valor */}
        <Card className="bg-gray-100 border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-2">Valor</p>
            <p className="text-xl font-bold text-gray-600">
              R$ 0,00
            </p>
            <p className="text-xs text-gray-500 mt-1">por mês</p>
          </CardContent>
        </Card>

        {/* Card 3: Data de Renovação */}
        <Card className="bg-gray-100 border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-2">Renovação</p>
            <p className="text-xl font-bold text-gray-600">-</p>
            <p className="text-xs text-gray-500 mt-1">Plano gratuito</p>
          </CardContent>
        </Card>

        {/* Card 4: Consumo */}
        <Card className="bg-gray-100 border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-2">Consumo</p>
            <p className="text-xl font-bold mb-3 text-gray-600">
              {usage?.current || 0} / 5
            </p>
            <Progress value={(usage?.current || 0) / 5 * 100} className="h-2 bg-gray-300" />
            {(usage?.current || 0) >= 4 && <p className="text-xs text-yellow-600 font-medium mt-2">
                Próximo do limite
              </p>}
          </CardContent>
        </Card>
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-600">Faça o Upgrade do seu Plano</h2>
      </div>

      <div className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory max-w-6xl mx-auto">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isCurrentPlan = tier.priceId === "free";
          
          return (
            <Card key={tier.name} className={`relative flex-shrink-0 w-[320px] snap-start pt-8 ${isCurrentPlan ? "border-primary shadow-lg" : ""}`}>
              {isCurrentPlan && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary whitespace-nowrap">Plano Atual</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg text-gray-600">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-bold text-gray-600 text-xl">
                    {tier.price === 0 ? "Grátis" : <>
                        R$ {tier.price.toFixed(2).replace('.', ',')} <span className="font-normal text-muted-foreground text-base">/ mês</span>
                      </>}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>
                      {tier.limit >= 1000 ? "Documentos / envelopes ilimitados" : <>Até <strong>{tier.limit}</strong> documentos / envelopes</>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Usuários <strong>ilimitados</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Assinatura digital ICP-Brasil</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Notificações por email/WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    <span className={tier.priceId === "free" ? "text-gray-400 line-through" : ""}>
                      Geolocalização da assinatura
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    <span className={tier.priceId === "free" ? "text-gray-400 line-through" : ""}>
                      Eon Drive
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {tier.priceId === "free" || tier.name === "Básico" ? <X className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    <span className={tier.priceId === "free" || tier.name === "Básico" ? "text-gray-400 line-through" : ""}>
                      Biometria facial
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleUpgrade(tier)} 
                  disabled={processingCheckout || isCurrentPlan} 
                  className={isCurrentPlan ? "w-full" : "w-full bg-[#273d60] hover:bg-[#273d60]/90 text-white"} 
                  variant={isCurrentPlan ? "outline" : undefined}
                >
                  {processingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrentPlan ? "Plano Atual" : "Fazer Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="space-y-4 pt-4">
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => setIsComparisonOpen(!isComparisonOpen)} className="text-sm text-gray-600 hover:text-gray-900 hover:bg-transparent">
            {isComparisonOpen ? <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Ocultar Tabela Comparativa
              </> : <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Mostrar Tabela Comparativa
              </>}
          </Button>
        </div>
        
        <Collapsible open={isComparisonOpen} onOpenChange={setIsComparisonOpen}>
          <CollapsibleContent>
            <div className="overflow-x-auto scrollbar-hide rounded-lg max-w-6xl mx-auto border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-0">
                    <TableHead className="w-[200px] font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Recurso</TableHead>
                    {SUBSCRIPTION_TIERS.map(tier => <TableHead key={tier.name} className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-[#273d60]">{tier.name}</span>
                          <span className="text-sm text-gray-500 font-normal">
                            {tier.price === 0 ? "Grátis" : tier.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-white border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Documentos / Envelopes</TableCell>
                    {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                        {tier.limit}
                      </TableCell>)}
                  </TableRow>
                  <TableRow className="bg-gray-50 border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Usuários <strong>ilimitados</strong></TableCell>
                    {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      </TableCell>)}
                  </TableRow>
                  <TableRow className="bg-white border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Assinatura digital<br className="md:hidden" />ICP-Brasil</TableCell>
                    {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      </TableCell>)}
                  </TableRow>
                  <TableRow className="bg-white border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Notificação por<br className="md:hidden" />E-mail / WhatsApp</TableCell>
                    {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      </TableCell>)}
                  </TableRow>
                  <TableRow className="bg-gray-50 border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Geolocalização<br className="md:hidden" />da assinatura</TableCell>
                    {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                        {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 mx-auto" /> : <Check className="h-4 w-4 text-green-600 mx-auto" />}
                      </TableCell>)}
                  </TableRow>
                  <TableRow className="bg-white border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-white z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Eon Drive</TableCell>
                    {SUBSCRIPTION_TIERS.map(tier => <TableCell key={tier.name} className="text-center">
                        {tier.priceId === "free" ? <X className="h-4 w-4 text-gray-400 mx-auto" /> : <Check className="h-4 w-4 text-green-600 mx-auto" />}
                      </TableCell>)}
                  </TableRow>
                  <TableRow className="bg-gray-50 border-0">
                    <TableCell className="font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 md:static shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none">Biometria facial</TableCell>
                    {SUBSCRIPTION_TIERS.map((tier, index) => <TableCell key={tier.name} className="text-center">
                        {tier.priceId === "free" || index === 1 ? <X className="h-4 w-4 text-gray-400 mx-auto" /> : <Check className="h-4 w-4 text-green-600 mx-auto" />}
                      </TableCell>)}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* FAQ */}
      <div className="space-y-6 max-w-6xl mx-auto pt-4">
        <div className="text-center space-y-2">
          <h2 className="font-bold text-gray-700 text-xl">Perguntas Frequentes</h2>
          <p className="text-gray-500">Tire suas dúvidas sobre nossos planos e funcionalidades</p>
        </div>
        <Card className="border">
          <CardContent className="p-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Como funciona a contagem de documentos?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Cada documento enviado para assinatura conta como 1 documento no seu plano mensal. O contador é resetado no início de cada mês, permitindo que você utilize novamente todo o limite do seu plano.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-b">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Posso mudar de plano depois?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Sim, você pode fazer upgrade para um plano superior a qualquer momento. O novo limite de documentos será aplicado imediatamente e você será cobrado proporcionalmente pelo período restante do mês.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="border-b">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">As assinaturas digitais têm validade jurídica?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Sim, todas as assinaturas realizadas através do Eon Sign utilizam certificação ICP-Brasil e possuem plena validade jurídica conforme a MP 2.200-2/2001 e Lei 14.063/2020. Cada assinatura é registrada com timestamp, IP e geolocalização para máxima segurança.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="border-b">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Posso cancelar minha assinatura?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Sim, você pode cancelar sua assinatura a qualquer momento através do portal de gerenciamento. O acesso aos recursos pagos permanecerá ativo até o final do período já pago, e você não será cobrado no próximo ciclo.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5" className="border-b">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Como funcionam as notificações por WhatsApp?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Todos os signatários recebem notificações automáticas por WhatsApp e e-mail quando um documento é enviado para assinatura e quando o processo é concluído. Isso garante que nenhuma assinatura seja perdida.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6" className="border-b">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Existe período de teste gratuito?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Sim, o plano Grátis permite que você teste a plataforma com até 5 documentos por mês sem necessidade de cartão de crédito. É perfeito para conhecer todas as funcionalidades antes de escolher um plano pago.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-7" className="border-b">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Posso ter múltiplos usuários na minha conta?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Sim! Todos os planos incluem usuários ilimitados. O administrador da conta pode convidar outros membros da equipe através das Configurações &gt; Membros. Os membros convidados utilizam a assinatura da organização, sem necessidade de assinatura individual.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-8">
                <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">Os documentos ficam armazenados com segurança?</AccordionTrigger>
                <AccordionContent className="text-left">
                  Sim, todos os documentos são armazenados com criptografia de ponta a ponta em servidores seguros. Apenas você e os signatários autorizados têm acesso aos documentos. Os documentos assinados ficam disponíveis permanentemente no Eon Drive.
                </AccordionContent>
              </AccordionItem>
              </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Footer Logo */}
      <div className="flex flex-col items-center pt-0 pb-4">
        <img 
          src="/lovable-uploads/Eon_Tecnologia-4.png" 
          alt="Eon" 
          className="h-36"
        />
        <p className="text-xs text-gray-500 -mt-4">© {new Date().getFullYear()} Eon Tecnologia. Todos os direitos reservados.</p>
      </div>
    </div>;
}