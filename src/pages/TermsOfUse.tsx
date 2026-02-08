import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function TermsOfUse() {
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
              Termos de Uso
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Última atualização: 8 de fevereiro de 2026
            </p>

            <div className="prose prose-gray max-w-none space-y-6">
              <p className="text-gray-700">
                Ao acessar o eonSign, você concorda em cumprir estes termos. O eonSign é uma 
                plataforma de gestão de assinaturas eletrônicas operada pela eonhub Tecnologia LTDA.
              </p>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Objeto do Serviço</h2>
                <p className="text-gray-700">
                  O eonSign fornece ferramentas para upload, envio e assinatura eletrônica de documentos. 
                  Não somos parte nos contratos assinados através da plataforma, agindo apenas como o 
                  meio tecnológico.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Validade Jurídica</h2>
                <p className="text-gray-700">
                  As assinaturas realizadas no eonSign utilizam métodos de autenticação (e-mail, IP, logs) 
                  que visam garantir a integridade e autoria, em conformidade com a legislação brasileira 
                  vigente sobre assinaturas eletrônicas.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Responsabilidades do Usuário</h2>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Você é responsável pela veracidade dos dados inseridos.</li>
                  <li>É proibido o uso da plataforma para documentos ilícitos ou fraudulentos.</li>
                  <li>A guarda das credenciais de acesso é de responsabilidade exclusiva do usuário.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Limitação de Responsabilidade</h2>
                <p className="text-gray-700 mb-2">A eonhub Tecnologia LTDA não se responsabiliza por:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Conteúdo dos documentos enviados pelos usuários.</li>
                  <li>
                    Negócios jurídicos não concretizados por falhas de terceiros 
                    (ex: falta de sinal de internet do signatário).
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Foro</h2>
                <p className="text-gray-700">
                  Fica eleito o foro da comarca de Belém, Pará, para dirimir quaisquer questões 
                  oriundas destes termos.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
