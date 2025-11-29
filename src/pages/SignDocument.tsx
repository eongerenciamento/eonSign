import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-sign.png";

interface Signer {
  id: string;
  name: string;
  email: string;
  status: string;
  is_company_signer: boolean;
  signed_at: string | null;
}

interface Document {
  id: string;
  name: string;
  file_url: string;
  status: string;
  signed_by: number;
  signers: number;
}

const SignDocument = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [currentSigner, setCurrentSigner] = useState<Signer | null>(null);
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [isIdentified, setIsIdentified] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);

  useEffect(() => {
    if (documentId) {
      fetchDocumentData();
    }
  }, [documentId]);

  const fetchDocumentData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("get-document-for-signing", {
        body: { documentId, signerEmail: email || "" },
      });

      if (error) throw error;

      setDocument(data.document);
      setSigners(data.signers || []);
      
      if (data.currentSigner) {
        setCurrentSigner(data.currentSigner);
        setIsIdentified(true);
      }
    } catch (error: any) {
      console.error("Error fetching document:", error);
      toast.error("Erro ao carregar documento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdentify = async () => {
    if (!email) {
      toast.error("Por favor, informe seu e-mail");
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("get-document-for-signing", {
        body: { documentId, signerEmail: email },
      });

      if (error) throw error;

      if (!data.currentSigner) {
        toast.error("E-mail não encontrado na lista de signatários");
        return;
      }

      setCurrentSigner(data.currentSigner);
      setIsIdentified(true);
      toast.success("Identificação realizada com sucesso!");
    } catch (error: any) {
      console.error("Error identifying user:", error);
      toast.error("Erro ao identificar usuário");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    
    if (numbers.length <= 11) {
      // CPF format: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ format: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfCnpj(e.target.value);
    setCpf(formatted);
  };

  const handleSign = async () => {
    if (!cpf) {
      toast.error("Por favor, informe seu CPF/CNPJ");
      return;
    }

    if (!currentSigner) {
      toast.error("Signatário não identificado");
      return;
    }

    try {
      setIsSigning(true);
      const { data, error } = await supabase.functions.invoke("sign-document", {
        body: {
          documentId,
          signerId: currentSigner.id,
          cpf: cpf.replace(/\D/g, ""),
        },
      });

      if (error) throw error;

      toast.success("Documento assinado com sucesso!");
      setSignatureComplete(true);
      
      // Atualizar dados do documento
      await fetchDocumentData();
    } catch (error: any) {
      console.error("Error signing document:", error);
      toast.error("Erro ao assinar documento");
    } finally {
      setIsSigning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      signed: { label: "Assinado", className: "bg-green-700 text-white" },
      pending: { label: "Pendente", className: "bg-yellow-700 text-white" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#273d60] to-[#001a4d]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#273d60] to-[#001a4d]">
        <Card className="p-8 text-center">
          <p className="text-lg">Documento não encontrado</p>
        </Card>
      </div>
    );
  }

  if (signatureComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#273d60] to-[#001a4d] p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <div className="text-center mb-8">
            <img src={logo} alt="Éon Sign" className="h-16 mx-auto mb-4" />
          </div>
          
          <Card className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-700 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Assinatura Concluída!</h1>
            <p className="text-muted-foreground mb-6">
              Sua assinatura foi registrada com sucesso no documento "{document.name}".
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {document.signed_by === document.signers 
                ? "Todas as assinaturas foram coletadas. O documento está finalizado."
                : "Aguardando assinatura dos demais signatários."}
            </p>
            
            {currentSigner?.is_company_signer && (
              <Button 
                onClick={() => navigate("/dashboard")}
                className="bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white"
              >
                Ir para Dashboard
              </Button>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#273d60] to-[#001a4d] p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="Éon Sign" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Assinatura de Documento</h1>
        </div>

        {/* Identificação */}
        {!isIdentified && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Identificação</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Por favor, informe seu e-mail para acessar o documento
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <Button onClick={handleIdentify} className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white">
                Identificar
              </Button>
            </div>
          </Card>
        )}

        {/* Documento Info */}
        {isIdentified && (
          <>
            <Card className="p-6 mb-6">
              <div className="flex items-start gap-4">
                <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">{document.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Status: {getStatusBadge(document.status)}</span>
                    <span>•</span>
                    <span>Assinaturas: {document.signed_by}/{document.signers}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* PDF Viewer */}
            <Card className="p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Visualizar Documento</h3>
              {document.file_url ? (
                <iframe
                  src={document.file_url}
                  className="w-full h-[500px] border rounded-md"
                  title="Document Preview"
                />
              ) : (
                <p className="text-muted-foreground">Documento não disponível para visualização</p>
              )}
            </Card>

            {/* Signatários */}
            <Card className="p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Signatários</h3>
              <div className="space-y-3">
                {signers.map((signer) => (
                  <div key={signer.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div>
                      <p className="font-medium">{signer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {signer.email}
                        {signer.is_company_signer && " (Empresa)"}
                        {currentSigner?.id === signer.id && " (Você)"}
                      </p>
                    </div>
                    {getStatusBadge(signer.status)}
                  </div>
                ))}
              </div>
            </Card>

            {/* Formulário de Assinatura */}
            {currentSigner && currentSigner.status === "pending" && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Assinar Documento</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cpf">CPF/CNPJ</Label>
                    <Input
                      id="cpf"
                      value={cpf}
                      onChange={handleCpfChange}
                      placeholder="000.000.000-00"
                      maxLength={18}
                    />
                  </div>
                  <Button
                    onClick={handleSign}
                    disabled={isSigning || !cpf}
                    className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white"
                  >
                    {isSigning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Assinar Documento"
                    )}
                  </Button>
                </div>
              </Card>
            )}

            {currentSigner && currentSigner.status === "signed" && (
              <Card className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-700 mx-auto mb-4" />
                <p className="text-lg font-medium">Você já assinou este documento</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Assinado em {new Date(currentSigner.signed_at!).toLocaleString("pt-BR")}
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SignDocument;
