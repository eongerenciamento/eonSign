import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#273D60] to-[#0a1525]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <button
          onClick={() => navigate(-1)}
          className="text-white hover:text-gray-300 transition-colors p-2"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <img
          src="/logo-eon-white.png"
          alt="eonhub"
          className="h-8"
        />
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Content */}
      <main className="px-4 pb-8 md:px-8">
        <Card className="max-w-3xl mx-auto rounded-3xl">
          <CardContent className="p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Política de Privacidade
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Última atualização: 8 de fevereiro de 2026
            </p>

            <div className="prose prose-gray max-w-none space-y-6">
              <p className="text-gray-700">
                A eonhub Tecnologia LTDA, sob o nome comercial eonhub, valoriza a sua privacidade. 
                Esta Política descreve como coletamos e protegemos seus dados em conformidade com a 
                LGPD (Lei Geral de Proteção de Dados).
              </p>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Coleta de Dados</h2>
                <ul className="space-y-3 text-gray-700">
                  <li>
                    <strong>Dados de Conta:</strong> Ao utilizar o Login com Google, coletamos seu nome, 
                    e-mail e foto de perfil para identificação no sistema.
                  </li>
                  <li>
                    <strong>Dados de Assinatura:</strong> Coletamos endereços IP, geolocalização aproximada 
                    e dados do dispositivo dos signatários para compor o log de auditoria e garantir a 
                    validade jurídica das assinaturas.
                  </li>
                  <li>
                    <strong>Documentos:</strong> Os documentos enviados para assinatura são armazenados 
                    de forma criptografada e acessíveis apenas às partes autorizadas.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Uso das Informações</h2>
                <p className="text-gray-700 mb-2">Utilizamos seus dados para:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Gerenciar sua conta e acesso ao sistema.</li>
                  <li>Notificar signatários sobre documentos pendentes.</li>
                  <li>Garantir a segurança e prevenir fraudes no processo de assinatura.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Compartilhamento de Dados</h2>
                <p className="text-gray-700">
                  Não vendemos seus dados a terceiros. O compartilhamento ocorre apenas com provedores 
                  de infraestrutura (como Lovable Cloud e serviços de armazenamento) estritamente 
                  necessários para o funcionamento do serviço.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Seus Direitos</h2>
                <p className="text-gray-700">
                  Você pode, a qualquer momento, solicitar o acesso, correção ou exclusão de seus 
                  dados pessoais através do suporte técnico em Belém/PA.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
