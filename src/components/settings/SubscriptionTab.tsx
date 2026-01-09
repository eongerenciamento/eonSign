import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PRICE_IDS_MENSAL, PRICE_IDS_ANUAL } from "@/constants/stripe";

const SUBSCRIPTION_TIERS = [
  {
    name: "Start",
    limit: 25,
    price: 54.9,
    priceAnual: 559.08,
    priceId: PRICE_IDS_MENSAL.START,
    priceIdAnual: PRICE_IDS_ANUAL.START,
    description: "Para pequenas empresas",
  },
  {
    name: "Pro",
    limit: 50,
    price: 89.9,
    priceAnual: 916.80,
    priceId: PRICE_IDS_MENSAL.PRO,
    priceIdAnual: PRICE_IDS_ANUAL.PRO,
    description: "Para empresas em crescimento",
  },
  {
    name: "Empresarial I",
    limit: 100,
    price: 159.9,
    priceAnual: 1631.00,
    priceId: PRICE_IDS_MENSAL.EMPRESARIAL_I,
    priceIdAnual: PRICE_IDS_ANUAL.EMPRESARIAL_I,
    description: "Para empresas estabelecidas",
  },
  {
    name: "Empresarial II",
    limit: 200,
    price: 209.9,
    priceAnual: 2140.98,
    priceId: PRICE_IDS_MENSAL.EMPRESARIAL_II,
    priceIdAnual: PRICE_IDS_ANUAL.EMPRESARIAL_II,
    description: "Para grandes volumes",
  },
  {
    name: "Ultra",
    limit: -1, // -1 representa ilimitado
    price: 289.9,
    priceAnual: 2956.98,
    priceId: PRICE_IDS_MENSAL.ULTRA,
    priceIdAnual: PRICE_IDS_ANUAL.ULTRA,
    description: "Documentos ilimitados",
  },
];

// Comparison Table Component
interface ComparisonTableProps {
  currentPlanLimit?: number;
  isFreeTier?: boolean;
  processingCheckout: boolean;
  onUpgrade: (tier: typeof SUBSCRIPTION_TIERS[0]) => void;
}

function ComparisonTable({
  currentPlanLimit,
  isFreeTier,
  processingCheckout,
  onUpgrade
}: ComparisonTableProps) {
  // Helper para comparar limites considerando -1 como ilimitado
  const compareLimits = (tierLimit: number, userLimit: number | undefined): boolean => {
    if (!userLimit) return false;
    if (tierLimit === -1 && userLimit === -1) return true;
    return tierLimit === userLimit;
  };

  return (
    <div className="overflow-x-auto scrollbar-hide rounded-lg max-w-6xl mx-auto border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-0 bg-secondary/50">
            <TableHead className="w-[200px] font-semibold text-xs text-foreground/80 sticky left-0 bg-secondary/50 z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              Recurso
            </TableHead>
            {SUBSCRIPTION_TIERS.map(tier => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              return (
                <TableHead key={tier.name} className={`text-center border-0 ${isCurrentPlan ? 'bg-muted' : 'bg-secondary/50'}`}>
                  <div className="flex flex-col items-center gap-0">
                    <span className="font-semibold text-xs text-foreground/80">{tier.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      R$ {tier.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-card border-0">
            <TableCell className="font-medium text-xs text-foreground/80 sticky left-0 bg-card z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              Documentos / Envelopes
            </TableCell>
            {SUBSCRIPTION_TIERS.map(tier => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              return (
                <TableCell key={tier.name} className={`text-center text-xs border-0 ${isCurrentPlan ? 'bg-muted' : ''}`}>
                  {tier.limit === -1 ? "Ilimitado" : tier.limit}
                </TableCell>
              );
            })}
          </TableRow>
          <TableRow className="bg-secondary/50 border-0">
            <TableCell className="font-medium text-xs text-foreground/80 sticky left-0 bg-secondary/50 z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              Usuários ilimitados
            </TableCell>
            {SUBSCRIPTION_TIERS.map(tier => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              return (
                <TableCell key={tier.name} className={`text-center text-xs border-0 ${isCurrentPlan ? 'bg-muted' : 'bg-secondary/50'}`}>
                  <Check className="h-4 w-4 text-green-500 mx-auto" />
                </TableCell>
              );
            })}
          </TableRow>
          <TableRow className="bg-card border-0">
            <TableCell className="font-medium text-xs text-foreground/80 sticky left-0 bg-card z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              Notificações
            </TableCell>
            {SUBSCRIPTION_TIERS.map(tier => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              return (
                <TableCell key={tier.name} className={`text-center text-xs border-0 ${isCurrentPlan ? 'bg-muted' : ''}`}>
                  <Check className="h-4 w-4 text-green-500 mx-auto" />
                </TableCell>
              );
            })}
          </TableRow>
          <TableRow className="bg-secondary/50 border-0">
            <TableCell className="font-medium text-xs text-foreground/80 sticky left-0 bg-secondary/50 z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              Geolocalização
            </TableCell>
            {SUBSCRIPTION_TIERS.map(tier => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              return (
                <TableCell key={tier.name} className={`text-center text-xs border-0 ${isCurrentPlan ? 'bg-muted' : 'bg-secondary/50'}`}>
                  <Check className="h-4 w-4 text-green-500 mx-auto" />
                </TableCell>
              );
            })}
          </TableRow>
          <TableRow className="bg-card border-0">
            <TableCell className="font-medium text-xs text-foreground/80 sticky left-0 bg-card z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              Eon Drive
            </TableCell>
            {SUBSCRIPTION_TIERS.map(tier => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              return (
                <TableCell key={tier.name} className={`text-center text-xs border-0 ${isCurrentPlan ? 'bg-muted' : ''}`}>
                  <Check className="h-4 w-4 text-green-500 mx-auto" />
                </TableCell>
              );
            })}
          </TableRow>
          <TableRow className="bg-secondary/50 border-0">
            <TableCell className="font-medium text-xs text-foreground/80 sticky left-0 bg-secondary/50 z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              Suporte
            </TableCell>
            {SUBSCRIPTION_TIERS.map((tier, index) => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              // Suporte disponível a partir do Pro (index >= 1)
              const hasSupport = index >= 1;
              return (
                <TableCell key={tier.name} className={`text-center text-xs border-0 ${isCurrentPlan ? 'bg-muted' : 'bg-secondary/50'}`}>
                  {hasSupport ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                </TableCell>
              );
            })}
          </TableRow>
          {/* Action buttons row */}
          <TableRow className="bg-card border-b border-border">
            <TableCell className="font-medium text-xs text-foreground/80 sticky left-0 bg-card z-10 md:static border-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
              
            </TableCell>
            {SUBSCRIPTION_TIERS.map(tier => {
              const isCurrentPlan = !isFreeTier && compareLimits(tier.limit, currentPlanLimit);
              // Comparar limites para upgrade/downgrade (considerando -1 como maior que todos)
              const getTierValue = (limit: number) => limit === -1 ? 999999 : limit;
              const isDowngrade = !isFreeTier && currentPlanLimit && getTierValue(tier.limit) < getTierValue(currentPlanLimit);
              return (
                <TableCell key={tier.name} className={`text-center border-0 ${isCurrentPlan ? 'bg-muted' : ''}`}>
                  {isCurrentPlan ? (
                    <Badge variant="outline" className="bg-secondary text-foreground/80 border-border">
                      Atual
                    </Badge>
                  ) : (
                    <Button onClick={() => onUpgrade(tier)} disabled={processingCheckout} size="sm" className={isDowngrade ? "bg-blue-500 hover:bg-blue-600 text-white border-0" : "bg-blue-600 hover:bg-blue-700 text-white"}>
                      {processingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : isDowngrade ? "Downgrade" : "Upgrade"}
                    </Button>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// FAQ Component
function FAQSection() {
  const faqItems = [{
    question: "Quais tipos de assinatura o eonSign permite?",
    answer: "O sistema disponibiliza as assinaturas Simples, Avançada, Qualificada e Prescrição Médica, todas em observância à legislação brasileira."
  }, {
    question: "Sou obrigado a ter certificado digital?",
    answer: "Não. A Lei n. 14.063/2020 prevê a assinatura eletrônica simples, que pode ser utilizada entre particulares em diversas ocasiões. No entanto, alguns negócios jurídicos específicos necessitam de certificado digital válido integrante da cadeia ICP-Brasil, que é comercializado pela eonSign."
  }, {
    question: "Como funciona a contagem de documentos?",
    answer: "Cada documento enviado para assinatura conta como 1 documento no seu plano mensal. O contador é resetado no início de cada mês, permitindo que você utilize novamente todo o limite do seu plano."
  }, {
    question: "Posso mudar de plano depois?",
    answer: "Sim, você pode fazer upgrade para um plano superior a qualquer momento. O novo limite de documentos será aplicado imediatamente e você será cobrado proporcionalmente pelo período restante do mês."
  }, {
    question: "As assinaturas digitais têm validade jurídica?",
    answer: "Sim, todas as assinaturas realizadas através do eonSign utilizam certificação ICP-Brasil e possuem plena validade jurídica conforme a MP 2.200-2/2001 e Lei 14.063/2020. Cada assinatura é registrada com timestamp, IP e geolocalização para máxima segurança."
  }, {
    question: "Posso cancelar minha assinatura?",
    answer: "Sim, você pode cancelar sua assinatura a qualquer momento através do portal de gerenciamento. O acesso aos recursos pagos permanecerá ativo até o final do período já pago, e você não será cobrado no próximo ciclo."
  }, {
    question: "Como funcionam as notificações por WhatsApp?",
    answer: "Todos os signatários recebem notificações automáticas por WhatsApp e e-mail quando um documento é enviado para assinatura e quando o processo é concluído. Isso garante que nenhuma assinatura seja perdida."
  }, {
    question: "Existe período de teste gratuito?",
    answer: "Sim, o plano Grátis permite que você teste a plataforma com até 5 documentos por mês sem necessidade de cartão de crédito. É perfeito para conhecer todas as funcionalidades antes de escolher um plano pago."
  }, {
    question: "Posso ter múltiplos usuários na minha conta?",
    answer: "Sim! Todos os planos incluem usuários ilimitados. O administrador da conta pode convidar outros membros da equipe através das Configurações > Membros. Os membros convidados utilizam a assinatura da organização, sem necessidade de assinatura individual."
  }, {
    question: "Os documentos ficam armazenados com segurança?",
    answer: "Sim, todos os documentos são armazenados com criptografia de ponta a ponta em servidores seguros. Apenas você e os signatários autorizados têm acesso aos documentos. Os documentos assinados ficam disponíveis permanentemente no Eon Drive."
  }];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pt-4">
      <div className="text-center">
        <h2 className="font-bold text-base text-muted-foreground">Perguntas Frequentes</h2>
      </div>
      <div className="rounded-lg overflow-hidden">
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, index) => (
            <AccordionItem key={`item-${index + 1}`} value={`item-${index + 1}`} className={`border-0 ${index % 2 === 0 ? 'bg-card' : 'bg-secondary/50'} ${index === 0 ? 'rounded-t-lg' : ''} ${index === faqItems.length - 1 ? 'rounded-b-lg' : ''}`}>
              <AccordionTrigger className="text-left text-sm text-foreground/80 justify-start [&>svg]:ml-auto px-4 hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-left px-4 text-sm text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

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

      const { data: subData } = await supabase.from("user_subscriptions").select("*").eq("user_id", user.id).single();
      setSubscription(subData);

      const { data: limitData } = await supabase.functions.invoke("check-document-limit");
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

  const handleUpgrade = async (tier: (typeof SUBSCRIPTION_TIERS)[0]) => {
    if (tier.priceId === "free") {
      toast.info("Você já está no plano gratuito");
      return;
    }
    setProcessingCheckout(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("Email do usuário não encontrado");
      }
      const { data: companyData } = await supabase.from("company_settings").select("company_name").eq("user_id", user.id).single();
      const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
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
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
      active: { variant: "outline", label: "Ativo", className: "border-blue-600 text-blue-600 bg-transparent" },
      trialing: { variant: "secondary", label: "Teste" },
      past_due: { variant: "destructive", label: "Vencido" },
      canceled: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // User has active tier
  if (subscription && subscription.status === "active") {
    const usagePercent = usage ? usage.current / subscription.document_limit * 100 : 0;
    return (
      <div className="space-y-10">
        {/* Grid com 4 cards de informação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {/* Card 1: Plano Atual */}
          <Card className="bg-secondary border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Plano Atual</p>
                {getStatusBadge(subscription.status)}
              </div>
              <p className="text-xl font-bold text-blue-600 mb-1">{subscription.plan_name}</p>
              <Button onClick={handleManageSubscription} variant="link" className="p-0 h-auto text-xs text-blue-600 hover:text-blue-700">
                Extrato de Pagamentos
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Valor */}
          <Card className="bg-secondary border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Valor</p>
              <p className="text-xl font-bold text-blue-600">
                {SUBSCRIPTION_TIERS.find(t => t.name === subscription?.plan_name)?.price ? `R$ ${SUBSCRIPTION_TIERS.find(t => t.name === subscription?.plan_name)?.price.toFixed(2).replace(".", ",")}` : "R$ 0,00"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">por mês</p>
            </CardContent>
          </Card>

          {/* Card 3: Data de Renovação */}
          <Card className="bg-secondary border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Renovação</p>
              <p className="text-xl font-bold text-blue-600">
                {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                }) : "-"}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Consumo */}
          <Card className="bg-secondary border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Consumo</p>
              <p className="text-xl font-bold text-blue-600 mb-3">
                {usage?.current || 0} / {subscription.document_limit}
              </p>
              <Progress value={usagePercent} className="h-2 bg-muted" />
              {usagePercent >= 80 && <p className="text-xs text-yellow-600 font-medium mt-2">Próximo do limite</p>}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        <div className="pt-4">
          <ComparisonTable currentPlanLimit={subscription.document_limit} processingCheckout={processingCheckout} onUpgrade={handleUpgrade} />
        </div>

        {/* FAQ */}
        <FAQSection />
      </div>
    );
  }

  // User on free tier - show all paid tiers
  return (
    <div className="space-y-10">
      {/* Grid com 4 cards de informação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {/* Card 1: Plano Atual */}
        <Card className="bg-secondary border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Plano Atual</p>
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Ativo
              </Badge>
            </div>
            <p className="text-xl font-bold mb-1 text-foreground">Grátis</p>
            <Button onClick={handleManageSubscription} variant="link" className="p-0 h-auto text-xs text-primary">
              Extrato de Pagamentos
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Valor */}
        <Card className="bg-secondary border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">Valor</p>
            <p className="text-xl font-bold text-foreground">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">por mês</p>
          </CardContent>
        </Card>

        {/* Card 3: Data de Renovação */}
        <Card className="bg-secondary border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">Renovação</p>
            <p className="text-xl font-bold text-foreground">-</p>
            <p className="text-xs text-muted-foreground mt-1">Plano gratuito</p>
          </CardContent>
        </Card>

        {/* Card 4: Consumo */}
        <Card className="bg-secondary border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">Consumo</p>
            <p className="text-xl font-bold mb-3 text-foreground">{usage?.current || 0} / 5</p>
            <Progress value={(usage?.current || 0) / 5 * 100} className="h-2 bg-muted" />
            {(usage?.current || 0) >= 4 && <p className="text-xs text-yellow-600 font-medium mt-2">Próximo do limite</p>}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Table */}
      <ComparisonTable isFreeTier={true} processingCheckout={processingCheckout} onUpgrade={handleUpgrade} />

      {/* FAQ */}
      <FAQSection />

      {/* Footer Logo */}
      <div className="flex flex-col items-center pt-0 pb-4">
        <img src="/lovable-uploads/Eon_Tecnologia-4.png" alt="Eon" className="h-36" />
        <p className="text-xs text-muted-foreground -mt-4">
          © {new Date().getFullYear()} Eon Tecnologia. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
