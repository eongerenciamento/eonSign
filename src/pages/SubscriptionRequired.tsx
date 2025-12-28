import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import logoSign from "@/assets/logo-sign.png";

const TIERED_PRICE_ID = "price_1SWhQIHRTD5WvpxjPvRHBY18";

const SUBSCRIPTION_TIERS = [
  {
    name: "Essencial",
    documents: 50,
    price: 49.90,
    priceId: TIERED_PRICE_ID,
    description: "Ideal para profissionais autônomos",
  },
  {
    name: "Profissional",
    documents: 150,
    price: 99.90,
    priceId: TIERED_PRICE_ID,
    description: "Para pequenas equipes",
    popular: true,
  },
  {
    name: "Empresarial",
    documents: 500,
    price: 199.90,
    priceId: TIERED_PRICE_ID,
    description: "Para empresas em crescimento",
  },
  {
    name: "Corporativo",
    documents: 2000,
    price: 499.90,
    priceId: TIERED_PRICE_ID,
    description: "Para grandes operações",
  },
];

const features = [
  "Assinatura digital com validade jurídica",
  "Usuários ilimitados",
  "Notificações por e-mail e WhatsApp",
  "Geolocalização nas assinaturas",
  "Eon Drive - Armazenamento seguro",
  "Suporte prioritário",
];

export default function SubscriptionRequired() {
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubscribe = async (tier: typeof SUBSCRIPTION_TIERS[0]) => {
    setProcessingTier(tier.name);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para assinar");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
        body: {
          priceId: tier.priceId,
          documentLimit: tier.documents,
          planName: tier.name,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não recebida");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setProcessingTier(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <img src={logoSign} alt="eonSign" className="h-10" />
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-gray-600">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Assinatura Necessária
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Para acessar o eonSign, você precisa de uma assinatura ativa. 
              Escolha o plano que melhor atende às suas necessidades.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <Card 
                key={tier.name} 
                className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : 'border-gray-200'}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Mais Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      R$ {tier.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-gray-500">/mês</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    <strong>{tier.documents}</strong> documentos/mês
                  </p>
                  <Button 
                    className="w-full" 
                    onClick={() => handleSubscribe(tier)}
                    disabled={processingTier !== null}
                    variant={tier.popular ? "default" : "outline"}
                  >
                    {processingTier === tier.name ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Assinar Agora"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Features List */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Todos os planos incluem</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Help Text */}
          <p className="text-center text-sm text-gray-500 mt-8">
            Dúvidas? Entre em contato conosco pelo e-mail{" "}
            <a href="mailto:suporte@eontecnologia.com.br" className="text-primary hover:underline">
              suporte@eontecnologia.com.br
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
