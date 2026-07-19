import { ArrowLeft, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-center px-4 py-4 md:px-8">
        <img src="/logo-eon-sign.png" alt="eonSign" className="h-8" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          Privacidade
        </div>

        <h1 className="mt-4 text-4xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mt-2">Última atualização: 8 de fevereiro de 2026</p>

        <p className="mt-6 text-gray-700">
          A eonhub Tecnologia LTDA, sob o nome comercial eonhub, valoriza a sua privacidade.
          Esta Política descreve como coletamos e protegemos seus dados em conformidade com a
          LGPD (Lei Geral de Proteção de Dados).
        </p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>1. Coleta de Dados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              <strong>Dados de Conta:</strong> Ao utilizar o Login com Google, coletamos seu nome,
              e-mail e foto de perfil para identificação no sistema.
            </p>
            <p>
              <strong>Dados de Assinatura:</strong> Coletamos endereços IP, geolocalização aproximada
              e dados do dispositivo dos signatários para compor o log de auditoria e garantir a
              validade jurídica das assinaturas.
            </p>
            <p>
              <strong>Documentos:</strong> Os documentos enviados para assinatura são armazenados
              de forma criptografada e acessíveis apenas às partes autorizadas.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>2. Uso das Informações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Gerenciar sua conta e acesso ao sistema.</li>
              <li>Notificar signatários sobre documentos pendentes.</li>
              <li>Garantir a segurança e prevenir fraudes no processo de assinatura.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>3. Compartilhamento de Dados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Não vendemos seus dados a terceiros. O compartilhamento ocorre apenas com provedores
              de infraestrutura (como Lovable Cloud e serviços de armazenamento) estritamente
              necessários para o funcionamento do serviço.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>4. Seus Direitos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Você pode, a qualquer momento, solicitar o acesso, correção ou exclusão de seus
              dados pessoais através do suporte técnico em Belém/PA.
            </p>
          </CardContent>
        </Card>

        <footer className="mt-10 border-t pt-6 text-sm text-muted-foreground space-y-1">
          <p>eonhub Tecnologia LTDA</p>
          <p>
            Contato:{" "}
            <a href="mailto:contato@eonhub.com.br" className="hover:underline">
              contato@eonhub.com.br
            </a>
          </p>
          <p>Foro: Belém, Pará</p>
          <Link to="/auth" className="mt-4 inline-flex items-center gap-2 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
        </footer>
      </main>
    </div>
  );
}
