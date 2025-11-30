import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, FileText, Loader2, ChevronDown } from "lucide-react";
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
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [isIdentified, setIsIdentified] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);
  const [showSigners, setShowSigners] = useState(false);

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

  const validateCPF = (cpf: string): boolean => {
    const cleanCpf = cpf.replace(/\D/g, "");
    
    if (cleanCpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.charAt(10))) return false;
    
    return true;
  };

  const validateCNPJ = (cnpj: string): boolean => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    
    if (cleanCnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cleanCnpj)) return false;
    
    let size = cleanCnpj.length - 2;
    let numbers = cleanCnpj.substring(0, size);
    const digits = cleanCnpj.substring(size);
    let sum = 0;
    let pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    
    size = size + 1;
    numbers = cleanCnpj.substring(0, size);
    sum = 0;
    pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    
    return true;
  };

  const validateCpfCnpj = (value: string): boolean => {
    const clean = value.replace(/\D/g, "");
    
    if (clean.length === 11) {
      return validateCPF(clean);
    } else if (clean.length === 14) {
      return validateCNPJ(clean);
    }
    
    return false;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfCnpj(e.target.value);
    setCpf(formatted);
    
    // Validar CPF/CNPJ em tempo real
    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 11 || clean.length === 14) {
      setCpfValid(validateCpfCnpj(formatted));
    } else {
      setCpfValid(null);
    }
  };

  const handleSign = async () => {
    if (!cpf) {
      toast.error("Por favor, informe seu CPF/CNPJ");
      return;
    }

    // Validar CPF/CNPJ
    if (!validateCpfCnpj(cpf)) {
      const cleanCpf = cpf.replace(/\D/g, "");
      const type = cleanCpf.length === 11 ? "CPF" : cleanCpf.length === 14 ? "CNPJ" : "CPF/CNPJ";
      toast.error(`${type} inválido. Por favor, verifique o número informado.`);
      return;
    }

    if (!birthDate) {
      toast.error("Por favor, informe sua data de nascimento");
      return;
    }

    // Validar idade mínima de 18 anos
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) {
      toast.error("Você deve ter pelo menos 18 anos para assinar documentos");
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
          birthDate: birthDate,
        },
      });

      if (error) {
        console.error("Error from edge function:", error);
        const errorMessage = error.message || "Erro ao assinar documento";
        toast.error(errorMessage);
        return;
      }

      // Check if response contains error in data
      if (data && data.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Documento assinado com sucesso!");
      setSignatureComplete(true);
      
      // Atualizar dados do documento
      await fetchDocumentData();
    } catch (error: any) {
      console.error("Error signing document:", error);
      const errorMessage = error?.message || "Erro ao assinar documento";
      toast.error(errorMessage);
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
    <div className="min-h-screen bg-gradient-to-br from-[#273d60] to-[#001a4d]">
      {/* Identificação */}
      {!isIdentified && (
        <div className="max-w-4xl mx-auto p-4 pt-8">
          <div className="text-center mb-8">
            <img src={logo} alt="Éon Sign" className="h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Assinatura de Documento</h1>
          </div>
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
        </div>
      )}

      {/* Documento e Assinatura - Layout Full Screen */}
      {isIdentified && (
        <div className="flex flex-col h-screen">
          {/* Header com Logo */}
          <div className="bg-gradient-to-r from-[#273d60] to-[#001a4d] p-2 flex items-center justify-center">
            <img src={logo} alt="Éon Sign" className="h-10" />
          </div>

          {/* Área de Assinatura - Formulário Compacto */}
          {currentSigner && currentSigner.status === "pending" && (
            <div className="bg-white border-b shadow-sm p-4">
              <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div>
                      <Label htmlFor="cpf" className="text-xs">CPF/CNPJ</Label>
                      <Input
                        id="cpf"
                        value={cpf}
                        onChange={handleCpfChange}
                        placeholder="000.000.000-00"
                        maxLength={18}
                        className={`h-9 ${
                          cpfValid === false 
                            ? "border-red-500 focus-visible:ring-red-500" 
                            : cpfValid === true 
                            ? "border-green-500 focus-visible:ring-green-500" 
                            : ""
                        }`}
                      />
                      {cpfValid === false && (
                        <p className="text-xs text-red-500 mt-0.5">CPF/CNPJ inválido</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="birthDate" className="text-xs">Data de Nascimento</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={(() => {
                          const today = new Date();
                          today.setFullYear(today.getFullYear() - 18);
                          return today.toISOString().split('T')[0];
                        })()}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSign}
                    disabled={isSigning || !cpf || !birthDate || cpfValid === false}
                    className="bg-green-600 hover:bg-green-700 text-white h-9 px-8 md:min-w-[200px]"
                  >
                    {isSigning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "ASSINAR"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Já Assinou - Mensagem */}
          {currentSigner && currentSigner.status === "signed" && (
            <div className="bg-green-50 border-b border-green-200 p-3">
              <div className="max-w-6xl mx-auto flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-700" />
                <p className="text-sm font-medium text-green-700">
                  Você já assinou este documento em {new Date(currentSigner.signed_at!).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          )}

          {/* Informações do Documento e Signatários - Colapsável */}
          <div className="bg-gray-50 border-b">
            <div className="max-w-6xl mx-auto">
              <Collapsible open={showSigners} onOpenChange={setShowSigners}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-[#273d60]" />
                      <div className="text-left">
                        <p className="font-semibold">{document.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Assinaturas: {document.signed_by}/{document.signers}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`h-5 w-5 transition-transform ${showSigners ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Signatários:</p>
                    {signers.map((signer) => (
                      <div key={signer.id} className="flex items-center justify-between p-2 bg-white rounded-md border">
                        <div>
                          <p className="text-sm font-medium">{signer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {signer.email}
                            {signer.is_company_signer && " (Empresa)"}
                            {currentSigner?.id === signer.id && " (Você)"}
                          </p>
                        </div>
                        {getStatusBadge(signer.status)}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {/* PDF Viewer - Full Width */}
          <div className="flex-1 bg-gray-200">
            {document.file_url ? (
              <iframe
                src={`${document.file_url}#view=FitH`}
                className="w-full h-full border-0"
                title="Document Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Documento não disponível para visualização</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SignDocument;
