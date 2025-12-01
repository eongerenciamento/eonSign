import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlanCheckoutDialog } from "@/components/pricing/PlanCheckoutDialog";
const PLANS = [{
  id: "free",
  name: "Grátis",
  limit: 5,
  price: 0,
  priceId: "free",
  description: "Ideal para testes",
  features: [{
    name: "Quantidade de documentos",
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
  }]
}, {
  id: "basic",
  name: "Básico",
  limit: 20,
  price: 59,
  priceId: "price_1SZBDZHRTD5WvpxjeKMhFcSK",
  description: "Para pequenas empresas",
  recommended: false,
  features: [{
    name: "Quantidade de documentos",
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
  }]
}, {
  id: "pro",
  name: "Profissional",
  limit: 50,
  price: 99,
  priceId: "price_1SZBEAHRTD5Wvpxj0pcztkPt",
  description: "Para empresas em crescimento",
  recommended: true,
  features: [{
    name: "Quantidade de documentos",
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
  }]
}, {
  id: "business",
  name: "Empresarial",
  limit: 100,
  price: 159,
  priceId: "price_1SZBEOHRTD5WvpxjFsV37k0o",
  description: "Para empresas estabelecidas",
  features: [{
    name: "Quantidade de documentos",
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
  }]
}, {
  id: "premium",
  name: "Premium",
  limit: 500,
  price: 499,
  priceId: "price_1SZBEdHRTD5Wvpxj46hhdp54",
  description: "Para grandes volumes",
  features: [{
    name: "Quantidade de documentos",
    value: "500"
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
  }]
}, {
  id: "enterprise",
  name: "Enterprise",
  limit: 1000,
  price: 899,
  priceId: "price_1SZBEsHRTD5Wvpxj6t1lc01Z",
  description: "Documentos ilimitados",
  features: [{
    name: "Quantidade de documentos",
    value: "1000"
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
  const [showComparison, setShowComparison] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const handleSelectPlan = (plan: typeof PLANS[0]) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };
  return <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white">
        <div className="container mx-auto px-4 bg-[#273d60] py-0">
        <div className="flex items-center justify-between bg-[#273d60] my-0 py-[20px]">
          <div className="flex items-center gap-2">
            <img alt="Eon Sign" className="h-16" src="/lovable-uploads/1a011367-0097-4688-b76d-39b5e65a5c2b.png" />
          </div>
          <Button variant="ghost" onClick={() => navigate('/auth')} className="text-primary-foreground bg-transparent">
            Já tenho conta
          </Button>
        </div>
      </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4 md:text-3xl text-gray-600">
          Planos e Preços
        </h1>
        <p className="mb-8 max-w-2xl mx-auto text-lg text-gray-500">
          Escolha o plano ideal para o volume de documentos da sua empresa
        </p>
      </div>

      {/* Pricing Cards - Horizontal Scroll */}
      <div className="container mx-auto px-4 pb-16">
        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide pb-4">
            <div className="flex gap-6 px-4" style={{
            width: 'max-content'
          }}>
              {PLANS.map(plan => <Card key={plan.name} className="relative bg-[#273d60] text-white border-none w-96 flex-shrink-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <div className="h-7 flex justify-center">
                      {plan.recommended && <Badge className="py-1 font-bold w-fit text-primary-foreground px-[20px] border-primary bg-primary">Mais Vendido</Badge>}
                    </div>
                    <div>
                      <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                      <CardDescription className="text-gray-300">{plan.description}</CardDescription>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-white text-xl">
                          {plan.price === 0 ? 'Grátis' : `R$ ${plan.price}`}
                        </span>
                        {plan.price > 0 && <span className="text-gray-300">/mês</span>}
                      </div>
                      <p className="text-sm text-gray-300 mt-1">
                        {plan.limit >= 1000 ? 'Documentos ilimitados' : `${plan.limit} documentos/mês`}
                      </p>
                    </div>
                  </CardHeader>
                   <CardContent className="space-y-4">
                     <div className="space-y-3">
                       {plan.features.slice(1).map((feature, idx) => <div key={idx} className="flex items-center gap-2 text-sm">
                           {feature.included ? <Check className="h-4 w-4 text-green-400 flex-shrink-0" /> : <X className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                           <span className={feature.included ? 'text-white' : 'text-gray-400'}>
                             {feature.name}
                           </span>
                         </div>)}
                     </div>
                    <Button onClick={() => handleSelectPlan(plan)} variant="secondary" className="w-full font-bold text-primary-foreground bg-gray-400 hover:bg-gray-300">
                      {plan.price === 0 ? 'Começar Grátis' : 'Escolher Plano'}
                    </Button>
                  </CardContent>
                </Card>)}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table Toggle */}
      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" className="w-full text-[#273d60] hover:bg-gray-100" onClick={() => setShowComparison(!showComparison)}>
            {showComparison ? <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Ocultar Tabela Comparativa
              </> : <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Ver Tabela Comparativa Completa
              </>}
          </Button>
        </div>
      </div>

      {/* Comparison Table */}
      {showComparison && <div className="container mx-auto px-4 pb-16">
          <Card className="max-w-7xl mx-auto">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="sticky left-0 bg-card z-10 text-left py-4 px-4 min-w-[200px]">Recursos</th>
                      {PLANS.map(plan => <th key={plan.name} className="text-center py-4 px-4 min-w-[120px]">
                          <div className="font-semibold">{plan.name}</div>
                          <div className="text-sm text-muted-foreground font-normal">
                            {plan.price === 0 ? 'Grátis' : <><span className="text-xs">R$</span> {plan.price}/mês</>}
                          </div>
                        </th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PLANS[0].features.map((_, featureIdx) => <tr key={featureIdx} className="border-b">
                        <td className="sticky left-0 bg-card z-10 py-4 px-4 text-sm">
                          {PLANS[0].features[featureIdx].name}
                        </td>
                        {PLANS.map(plan => <td key={plan.name} className="text-center py-4 px-4">
                            {featureIdx === 0 ? <span className="text-sm font-medium">{plan.features[featureIdx].value || plan.limit}</span> : plan.features[featureIdx].included ? <Check className="h-5 w-5 text-green-600 mx-auto" /> : <X className="h-5 w-5 text-gray-400 mx-auto" />}
                          </td>)}
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>}

      {/* FAQ Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[#273d60] text-center mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-gray-600 text-center mb-12">
            Tire suas dúvidas sobre nossos planos e funcionalidades
          </p>
          <Card>
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((faq, idx) => <AccordionItem key={idx} value={`item-${idx}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
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

      {selectedPlan && <PlanCheckoutDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} plan={selectedPlan} />}
    </div>;
}