import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, FileText, Loader2, Plus, Minus, Download } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import logo from "@/assets/logo-sign.png";

// Schemas de validação
const emailSchema = z.string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .email("Formato de e-mail inválido")
  .max(255, "E-mail deve ter no máximo 255 caracteres");

const birthDateSchema = z.string()
  .min(1, "Data de nascimento é obrigatória")
  .refine((date) => {
    if (!date) return false;
    const birth = new Date(date);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 18;
  }, "Você deve ter pelo menos 18 anos para assinar documentos");

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
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [isIdentified, setIsIdentified] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);
  const [pdfScale, setPdfScale] = useState(1);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    if (documentId) {
      fetchDocumentData();
    }
  }, [documentId]);

  // Solicitar geolocalização quando o usuário é identificado
  useEffect(() => {
    if (isIdentified && !location && !locationError) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            console.log("Localização capturada:", position.coords);
          },
          (error) => {
            console.warn("Erro ao obter localização:", error);
            setLocationError(true);
            toast.info("Permissão de localização negada. A assinatura ainda é válida.");
          }
        );
      } else {
        setLocationError(true);
      }
    }
  }, [isIdentified, location, locationError]);

  const fetchDocumentData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("get-document-for-signing", {
        body: { documentId, signerEmail: email || "" },
      });

      if (error) {
        // Document was deleted or not found
        setLinkExpired(true);
        return;
      }

      if (!data.document) {
        setLinkExpired(true);
        return;
      }

      setDocument(data.document);
      setSigners(data.signers || []);
      
      if (data.currentSigner) {
        setCurrentSigner(data.currentSigner);
        setIsIdentified(true);
      }
    } catch (error: any) {
      console.error("Error fetching document:", error);
      setLinkExpired(true);
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (value: string): boolean => {
    try {
      emailSchema.parse(value);
      setEmailError(null);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.errors[0].message);
      }
      return false;
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (value.length > 0) {
      validateEmail(value);
    } else {
      setEmailError(null);
    }
  };

  const handleIdentify = async () => {
    if (!validateEmail(email)) {
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
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
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

  const handleZoomIn = () => {
    setPdfScale(prev => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setPdfScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleDownload = async () => {
    if (!document?.file_url) return;
    
    try {
      const response = await fetch(document.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.name}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("Download iniciado!");
    } catch (error) {
      toast.error("Erro ao baixar documento");
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

  if (linkExpired || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#273d60] to-[#001a4d] p-4">
        <Card className="p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Link Expirado</h2>
          <p className="text-muted-foreground">
            Este documento não está mais disponível para assinatura. 
            O link pode ter expirado ou o documento foi removido pelo remetente.
          </p>
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
                  onChange={handleEmailChange}
                  placeholder="seu@email.com"
                  maxLength={255}
                  className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {emailError && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>
              <Button 
                onClick={handleIdentify} 
                disabled={isLoading || !email || !!emailError}
                className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Identificando...
                  </>
                ) : (
                  "Identificar"
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Documento Info e Assinatura */}
        {isIdentified && (
          <>
            {/* PDF Viewer */}
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Visualizar Documento</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    className="h-8 w-8"
                    title="Diminuir zoom"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                    {Math.round(pdfScale * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    className="h-8 w-8"
                    title="Aumentar zoom"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownload}
                    className="h-8 w-8"
                    title="Baixar documento"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {document.file_url ? (
                <div className="overflow-auto border rounded-md bg-gray-100" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                  <iframe
                    src={`${document.file_url}#view=Fit&zoom=page-fit`}
                    className="w-full h-full border-0"
                    title="Document Preview"
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">Documento não disponível para visualização</p>
              )}
            </Card>

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
                    <div className="relative">
                      <Input
                        id="cpf"
                        value={cpf}
                        onChange={handleCpfChange}
                        placeholder="000.000.000-00"
                        maxLength={18}
                        className={
                          cpfValid === false 
                            ? "border-red-500 focus-visible:ring-red-500" 
                            : cpfValid === true 
                            ? "border-green-500 focus-visible:ring-green-500" 
                            : ""
                        }
                      />
                      {cpfValid === false && (
                        <p className="text-xs text-red-500 mt-1">
                          CPF/CNPJ inválido
                        </p>
                      )}
                      {cpfValid === true && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ CPF/CNPJ válido
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="birthDate">Data de Nascimento</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBirthDate(value);
                        if (value) {
                          try {
                            birthDateSchema.parse(value);
                            setBirthDateError(null);
                          } catch (error) {
                            if (error instanceof z.ZodError) {
                              setBirthDateError(error.errors[0].message);
                            }
                          }
                        } else {
                          setBirthDateError(null);
                        }
                      }}
                      max={(() => {
                        const today = new Date();
                        today.setFullYear(today.getFullYear() - 18);
                        return today.toISOString().split('T')[0];
                      })()}
                      className={birthDateError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {birthDateError ? (
                      <p className="text-xs text-red-500 mt-1">{birthDateError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Você deve ter pelo menos 18 anos
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSign}
                    disabled={isSigning || !cpf || !birthDate || cpfValid === false || !!birthDateError}
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
