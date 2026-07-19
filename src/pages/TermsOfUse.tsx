import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-center px-4 py-4 md:px-8">
        <img src="/logo-eon-sign.png" alt="eonSign" className="h-8" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          Termos de Uso
        </div>

        <h1 className="mt-4 text-4xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mt-2">Última atualização: 8 de fevereiro de 2026</p>

        <p className="mt-6 text-gray-700">
          Ao acessar o eonSign, você concorda em cumprir estes termos. O eonSign é uma
          plataforma de gestão de assinaturas eletrônicas operada pela eonhub Tecnologia LTDA.
        </p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>1. Objeto do Serviço</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              O eonSign fornece ferramentas para upload, envio e assinatura eletrônica de documentos.
              Não somos parte nos contratos assinados através da plataforma, agindo apenas como o
              meio tecnológico.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>2. Validade Jurídica</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              As assinaturas realizadas no eonSign utilizam métodos de autenticação (e-mail, IP, logs)
              que visam garantir a integridade e autoria, em conformidade com a legislação brasileira
              vigente sobre assinaturas eletrônicas.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>3. Responsabilidades do Usuário</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-1">
              <li>Você é responsável pela veracidade dos dados inseridos.</li>
              <li>É proibido o uso da plataforma para documentos ilícitos ou fraudulentos.</li>
              <li>A guarda das credenciais de acesso é de responsabilidade exclusiva do usuário.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>4. Limitação de Responsabilidade</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>A eonhub Tecnologia LTDA não se responsabiliza por:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Conteúdo dos documentos enviados pelos usuários.</li>
              <li>
                Negócios jurídicos não concretizados por falhas de terceiros
                (ex: falta de sinal de internet do signatário).
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>5. Foro</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Fica eleito o foro da comarca de Belém, Pará, para dirimir quaisquer questões
              oriundas destes termos.
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
