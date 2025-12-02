import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp, Instagram, Facebook, Youtube } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlanCheckoutDialog } from "@/components/pricing/PlanCheckoutDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const PLANS = [{
  id: "free",
  name: "Grátis",
  limit: 5,
  price: 0,
  priceId: "free",
  description: "Ideal para testes",
  features: [{
    name: "Quantidade de documentos / envelopes",
    value: "5"
  }, {
    name: "Assinatura digital ICP-Brasil",
    included: true
  }, {
    name: "Notificações por e-mail / WhatsApp",
    included: true
  }, {
    name: "Geolocalização da assinatura",
    included: false
  }, {
    name: "Eon Drive",
    included: false
  }, {
    name: "Biometria facial",
    included: false
  }]
}, {
  id: "basic",
  name: "Básico",
  limit: 20,
  price: 54.90,
  priceId: "price_1SZgF8HRTD5WvpxjUn1AZydj",
  description: "Para pequenas empresas",
  recommended: false,
  features: [{
    name: "Quantidade de documentos / envelopes",
    value: "20"
  }, {
    name: "Assinatura digital ICP-Brasil",
    included: true
  }, {
    name: "Notificações por e-mail / WhatsApp",
    included: true
  }, {
    name: "Geolocalização da assinatura",
    included: true
  }, {
    name: "Eon Drive",
    included: true
  }, {
    name: "Biometria facial",
    included: false
  }]
}, {
  id: "pro",
  name: "Profissional",
  limit: 50,
  price: 89.90,
  priceId: "price_1SZgFeHRTD5Wvpxju4vtwaM0",
  description: "Para empresas em crescimento",
  recommended: true,
  features: [{
    name: "Quantidade de documentos / envelopes",
    value: "50"
  }, {
    name: "Assinatura digital ICP-Brasil",
    included: true
  }, {
    name: "Notificações por e-mail / WhatsApp",
    included: true
  }, {
    name: "Geolocalização da assinatura",
    included: true
  }, {
    name: "Eon Drive",
    included: true
  }, {
    name: "Biometria facial",
    included: true
  }]
}, {
  id: "business",
  name: "Empresarial",
  limit: 100,
  price: 159.90,
  priceId: "price_1SZgFqHRTD5WvpxjHpfPyEEb",
  description: "Para empresas estabelecidas",
  features: [{
    name: "Quantidade de documentos / envelopes",
    value: "100"
  }, {
    name: "Assinatura digital ICP-Brasil",
    included: true
  }, {
    name: "Notificações por e-mail / WhatsApp",
    included: true
  }, {
    name: "Geolocalização da assinatura",
    included: true
  }, {
    name: "Eon Drive",
    included: true
  }, {
    name: "Biometria facial",
    included: true
  }]
}, {
  id: "premium",
  name: "Premium",
  limit: 150,
  price: 209.90,
  priceId: "price_1SZgG2HRTD5WvpxjzJMpIc9C",
  description: "Para grandes volumes",
  features: [{
    name: "Quantidade de documentos / envelopes",
    value: "150"
  }, {
    name: "Assinatura digital ICP-Brasil",
    included: true
  }, {
    name: "Notificações por e-mail / WhatsApp",
    included: true
  }, {
    name: "Geolocalização da assinatura",
    included: true
  }, {
    name: "Eon Drive",
    included: true
  }, {
    name: "Biometria facial",
    included: true
  }]
}, {
  id: "enterprise",
  name: "Enterprise",
  limit: 200,
  price: 289.90,
  priceId: "price_1SZgGCHRTD5Wvpxjj79RSMXX",
  description: "Para alto volume",
  features: [{
    name: "Quantidade de documentos / envelopes",
    value: "200"
  }, {
    name: "Assinatura digital ICP-Brasil",
    included: true
  }, {
    name: "Notificações por e-mail / WhatsApp",
    included: true
  }, {
    name: "Geolocalização da assinatura",
    included: true
  }, {
    name: "Eon Drive",
    included: true
  }, {
    name: "Biometria facial",
    included: true
  }]
}];
const FAQS = [{
  question: "Como funciona a contagem de documentos?",
  answer: "A contagem de documentos é mensal e reinicia automaticamente no primeiro dia de cada mês. Você pode enviar até o limite do seu plano por mês."
}, {
  question: "Posso mudar de plano depois?",
  answer: "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento através das configurações. As mudanças são aplicadas imediatamente."
}, {
  question: "As assinaturas digitais têm validade jurídica?",
  answer: "Sim, utilizamos certificação ICP-Brasil, que garante validade jurídica para todos os documentos assinados através da plataforma."
}, {
  question: "Posso cancelar minha assinatura?",
  answer: "Sim, você pode cancelar sua assinatura a qualquer momento. O plano permanece ativo até o final do período pago."
}, {
  question: "Como funcionam as notificações por WhatsApp?",
  answer: "Enviamos notificações automáticas via WhatsApp para os signatários quando um documento é enviado e quando é completamente assinado. Disponível nos planos pagos."
}, {
  question: "Existe período de teste gratuito?",
  answer: "Sim! O plano Grátis permite testar a plataforma com até 5 documentos por mês, sem necessidade de cartão de crédito."
}, {
  question: "Posso ter múltiplos usuários na minha conta?",
  answer: "Atualmente cada conta é individual. Para equipes maiores, recomendamos o plano Enterprise que oferece maior volume de documentos."
}, {
  question: "Os documentos ficam armazenados com segurança?",
  answer: "Sim, todos os documentos são armazenados com criptografia em servidores seguros, com acesso restrito apenas ao proprietário da conta."
}];
export default function Pricing() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showComparison, setShowComparison] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const handleSelectPlan = (plan: typeof PLANS[0]) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };
  return <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-100">
        <div className="container mx-auto px-4 py-4 bg-primary-foreground">
          <div className="flex items-center justify-between bg-primary-foreground">
            <img alt="Eon Sign" src="/lovable-uploads/Eon_Tecnologia-4.png" className="h-16 md:h-20" />
            <Button variant="ghost" onClick={() => navigate('/auth')} className="text-slate-600">
              Já tenho conta
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-600 md:text-xl">
          Planos e Preços
        </h1>
        <p className="mb-2 max-w-2xl mx-auto text-gray-500 text-base">
          Escolha o plano ideal para o volume de documentos da sua empresa
        </p>
        <p className="mb-8 max-w-2xl mx-auto text-sm text-gray-400">
          Se seu volume de assinaturas é maior entre em contato:{" "}
          <a href="mailto:contato@eongerenciamento.com.br" className="underline text-primary">
            contato@eongerenciamento.com.br
          </a>
        </p>
      </div>

      {/* Pricing Cards - Horizontal Scroll */}
      <div className="container mx-auto px-4 pb-16">
        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide pb-4">
            <div className="flex gap-5 px-4" style={{
            width: 'max-content'
          }}>
              {PLANS.map(plan => <Card key={plan.name} className={`relative bg-white border-2 w-80 flex-shrink-0 shadow-lg ${plan.recommended ? 'border-[#273d60]' : 'border-gray-200'}`}>
                  <CardHeader className="space-y-3 pb-4 pt-5 px-5">
                    <div className="h-6 flex justify-center">
                      {plan.recommended && <Badge className="py-1 font-bold w-fit px-[16px] bg-[#273d60] text-white border-0 text-xs">Mais Vendido</Badge>}
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-600">{plan.name}</CardTitle>
                      <CardDescription className="text-gray-500 text-sm mt-1">{plan.description}</CardDescription>
                    </div>
                    <div className="pt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-gray-600 text-3xl">
                          {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
                        </span>
                        {plan.price > 0 && <span className="text-gray-500 text-base">/mês</span>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 px-5 pb-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-gray-600">
                          Até <strong>{plan.limit}</strong> documentos / envelopes
                        </span>
                      </div>
                      {plan.features.slice(1).map((feature, idx) => <div key={idx} className="flex items-center gap-2 text-sm">
                          {feature.included ? <>
                              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span className="text-gray-600">{feature.name}</span>
                            </> : <>
                              <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-400 line-through">{feature.name}</span>
                            </>}
                        </div>)}
                    </div>
                    <Button onClick={() => handleSelectPlan(plan)} className="w-full font-bold text-white bg-[#273d60] hover:bg-[#1e2d47] rounded-xl h-12 text-sm">
                      {plan.price === 0 ? 'Começar Grátis' : 'Fazer Upgrade'}
                    </Button>
                  </CardContent>
                </Card>)}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          <Collapsible open={showComparison} onOpenChange={setShowComparison}>
            <button className="w-full flex items-center justify-center py-2 text-gray-500 cursor-pointer" onClick={() => setShowComparison(!showComparison)}>
              {showComparison ? <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Ocultar Tabela Comparativa
                </> : <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Ver Tabela Comparativa Completa
                </>}
            </button>
            <CollapsibleContent>
              <Card className="mt-4 border border-gray-200 rounded-lg shadow-none">
                <CardContent className="p-0">
                  <div className="overflow-x-auto scrollbar-hide">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-white z-10 text-left py-4 px-4 min-w-[200px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none text-gray-700 font-semibold">
                            Recursos
                          </TableHead>
                          {PLANS.map(plan => <TableHead key={plan.name} className="text-center py-4 px-4 min-w-[120px]">
                              <div className="font-semibold text-gray-700">{plan.name}</div>
                              <div className="text-sm text-gray-500 font-normal">
                                {plan.price === 0 ? 'Grátis' : <>{plan.price.toFixed(2).replace('.', ',')}/mês</>}
                              </div>
                            </TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PLANS[0].features.map((_, featureIdx) => {
                        const featureName = PLANS[0].features[featureIdx].name;
                        const renderFeatureName = () => {
                          if (featureName === "Assinatura digital ICP-Brasil") {
                            return <>Assinatura digital<br className="md:hidden" />ICP-Brasil</>;
                          }
                          if (featureName === "Notificações por e-mail / WhatsApp") {
                            return <>Notificações por<br className="md:hidden" />e-mail / WhatsApp</>;
                          }
                          if (featureName === "Geolocalização da assinatura") {
                            return <>Geolocalização<br className="md:hidden" />da assinatura</>;
                          }
                          if (featureName.includes('/')) {
                            return <>{featureName.split('/')[0]}/<br className="md:hidden" />{featureName.split('/')[1]}</>;
                          }
                          return featureName;
                        };
                        return <TableRow key={featureIdx} className={featureIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <TableCell className="sticky left-0 z-10 py-4 px-4 text-sm shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] md:shadow-none text-gray-600 bg-inherit">
                              {renderFeatureName()}
                            </TableCell>
                            {PLANS.map(plan => <TableCell key={plan.name} className="text-center py-4 px-4">
                                {featureIdx === 0 ? <span className="text-sm font-medium text-gray-600">{plan.features[featureIdx].value || plan.limit}</span> : plan.features[featureIdx].included ? <Check className="h-5 w-5 text-green-600 mx-auto" /> : <X className="h-5 w-5 text-gray-400 mx-auto" />}
                              </TableCell>)}
                          </TableRow>;
                      })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-bold text-center mb-4 text-xl text-gray-600">
            Perguntas Frequentes
          </h2>
          <p className="text-center mb-12 text-base text-gray-500">
            Tire suas dúvidas sobre nossos planos e funcionalidades
          </p>
          <Card className="border">
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((faq, idx) => <AccordionItem key={idx} value={`item-${idx}`} className="border-b">
                    <AccordionTrigger className="text-left text-xs md:text-base text-gray-600 justify-start [&>svg]:ml-auto">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-left">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>)}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16 text-center bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-[#273d60] mb-4">
            Pronto para começar?
          </h2>
          <p className="text-gray-600 mb-8">
            Comece gratuitamente e faça upgrade quando precisar de mais documentos
          </p>
          <Button size="lg" className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90" onClick={() => handleSelectPlan(PLANS[0])}>
            Começar Agora
          </Button>
        </div>
      </div>

      {/* Footer Logo */}
      <div className="flex flex-col items-center pt-0 pb-4 px-8">
        <div className="relative w-full flex items-center justify-center md:block">
          <img src="/lovable-uploads/Eon_Tecnologia-4.png" alt="Eon" className="h-36" />
          <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 items-center gap-4">
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
              <Instagram className="h-6 w-6" strokeWidth={1} />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
              <Facebook className="h-6 w-6" strokeWidth={1} />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
              <Youtube className="h-6 w-6" strokeWidth={1} />
            </a>
          </div>
        </div>
        {/* Mobile social icons */}
        <div className="flex md:hidden items-center gap-3 -mt-4">
          <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
            <Instagram className="h-[18px] w-[18px]" strokeWidth={1} />
          </a>
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
            <Facebook className="h-[18px] w-[18px]" strokeWidth={1} />
          </a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
            <Youtube className="h-[18px] w-[18px]" strokeWidth={1} />
          </a>
        </div>
      </div>

      {selectedPlan && <PlanCheckoutDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} plan={selectedPlan} />}
    </div>;
}