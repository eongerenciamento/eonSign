import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, FileText, Loader2, Plus, Minus, Download, PenLine, Award, ShieldCheck, MapPin, Camera } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import logo from "@/assets/logo-sign-white.png";
import { SelfieCaptureDialog } from "@/components/documents/SelfieCaptureDialog";

const emailSchema = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .email("Formato de e-mail inválido")
  .max(255, "E-mail deve ter no máximo 255 caracteres");

const birthDateSchema = z
  .string()
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
  signature_mode?: string;
  require_facial_biometry?: boolean;
}

const SignDocument = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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
  const [locationRequesting, setLocationRequesting] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [autoIdentifyChecked, setAutoIdentifyChecked] = useState(false);

  // Simple signature specific states
  const [typedSignature, setTypedSignature] = useState("");
  
  // Selfie capture states
  const [showSelfieDialog, setShowSelfieDialog] = useState(false);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);

  const isSimpleSignature = document?.signature_mode === "SIMPLE" || !document?.signature_mode;
  const requiresFacialBiometry = document?.require_facial_biometry === true;

  // Auto-identify logged-in user (internal signer)
  useEffect(() => {
    const autoIdentifyLoggedUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          // Fetch admin_email, admin_cpf and admin_birth_date from company_settings
          const { data: companyData } = await supabase
            .from("company_settings")
            .select("admin_email, admin_cpf, admin_birth_date")
            .eq("user_id", user.id)
            .maybeSingle();

          if (companyData?.admin_email) {
            setEmail(companyData.admin_email);
          }

          // Pre-fill CPF if available
          if (companyData?.admin_cpf) {
            const formattedCpf = formatCpfCnpj(companyData.admin_cpf);
            setCpf(formattedCpf);
            setCpfValid(validateCpfCnpj(formattedCpf));
          }

          // Pre-fill birth date if available
          if ((companyData as any)?.admin_birth_date) {
            setBirthDate((companyData as any).admin_birth_date);
          }
        }
      } catch (error) {
        console.log("User not logged in, manual identification required");
      } finally {
        setAutoIdentifyChecked(true);
      }
    };

    autoIdentifyLoggedUser();
  }, []);

  // Fetch document data after auto-identify check completes
  useEffect(() => {
    if (documentId && autoIdentifyChecked) {
      fetchDocumentData(email);
    }
  }, [documentId, autoIdentifyChecked]);

  // Request geolocation when identified - MANDATORY for simple signatures
  useEffect(() => {
    if (isIdentified && !location && !locationError && !locationRequesting) {
      requestLocation();
    }
  }, [isIdentified, location, locationError, locationRequesting]);

  const requestLocation = () => {
    if ("geolocation" in navigator) {
      setLocationRequesting(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationRequesting(false);
          console.log("Localização capturada:", position.coords);
        },
        (error) => {
          console.warn("Erro ao obter localização:", error);
          setLocationError(true);
          setLocationRequesting(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError(true);
    }
  };

  // Pre-fill typed signature with signer name
  useEffect(() => {
    if (currentSigner && !typedSignature) {
      setTypedSignature(currentSigner.name);
    }
  }, [currentSigner]);

  const fetchDocumentData = async (signerEmail?: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("get-document-for-signing", {
        body: { documentId, signerEmail: signerEmail || email || "" },
      });

      if (error) {
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
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
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

    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 11 || clean.length === 14) {
      setCpfValid(validateCpfCnpj(formatted));
    } else {
      setCpfValid(null);
    }
  };

  const handleSelfieCapture = (base64: string) => {
    setSelfieBase64(base64);
    toast.success("Selfie capturada com sucesso!");
  };

  const handleSign = async () => {
    if (!cpf) {
      toast.error("Por favor, informe seu CPF/CNPJ");
      return;
    }

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

    // For simple signatures, require typed signature
    if (isSimpleSignature && !typedSignature.trim()) {
      toast.error("Por favor, digite sua assinatura");
      return;
    }

    // For simple signatures, geolocation is MANDATORY
    if (isSimpleSignature && !location) {
      toast.error("A localização é obrigatória para assinar este documento. Por favor, permita o acesso à sua localização.");
      return;
    }

    // If facial biometry is required, check for selfie
    if (isSimpleSignature && requiresFacialBiometry && !selfieBase64) {
      toast.error("A biometria facial é obrigatória para este documento. Por favor, capture sua selfie.");
      setShowSelfieDialog(true);
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
          // Simple signature specific data
          typedSignature: isSimpleSignature ? typedSignature : null,
          // Selfie data (if captured)
          selfieBase64: selfieBase64 || null,
        },
      });

      if (error) {
        console.error("Error from edge function:", error);
        toast.error(error.message || "Erro ao assinar documento");
        return;
      }

      if (data && data.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Documento assinado com sucesso!");
      setSignatureComplete(true);
      await fetchDocumentData();
    } catch (error: any) {
      console.error("Error signing document:", error);
      toast.error(error?.message || "Erro ao assinar documento");
    } finally {
      setIsSigning(false);
    }
  };

  const handleZoomIn = () => {
    setPdfScale((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setPdfScale((prev) => Math.max(prev - 0.25, 0.5));
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
      <div className="light" style={{ colorScheme: 'light' }}>
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #273d60, #001a4d)' }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#ffffff' }} />
        </div>
      </div>
    );
  }

  if (linkExpired || !document) {
    return (
      <div className="light" style={{ colorScheme: 'light' }}>
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom right, #273d60, #001a4d)' }}>
          <Card className="p-8 text-center max-w-md" style={{ backgroundColor: '#ffffff' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#fee2e2' }}>
              <FileText className="h-8 w-8" style={{ color: '#dc2626' }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#111827' }}>Link Expirado</h2>
            <p style={{ color: '#6b7280' }}>
              Este documento não está mais disponível para assinatura. O link pode ter expirado ou o documento foi
              removido pelo remetente.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (signatureComplete) {
    return (
      <div className="light" style={{ colorScheme: 'light' }}>
        <div className="min-h-screen p-4" style={{ background: 'linear-gradient(to bottom right, #273d60, #001a4d)' }}>
          <div className="max-w-2xl mx-auto pt-8">
            <div className="text-center mb-8">
              <img src={logo} alt="eonSign" className="h-16 mx-auto mb-4" />
            </div>

            <Card className="p-8 text-center" style={{ backgroundColor: '#ffffff' }}>
              <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: '#15803d' }} />
              <h1 className="text-2xl font-bold mb-4" style={{ color: '#111827' }}>Assinatura Concluída!</h1>
              <p className="mb-6" style={{ color: '#6b7280' }}>
                Sua assinatura foi registrada com sucesso no documento "{document.name}".
              </p>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                {document.signed_by === document.signers
                  ? "Todas as assinaturas foram coletadas. O documento está finalizado."
                  : "Aguardando assinatura dos demais signatários."}
              </p>

              {currentSigner?.is_company_signer && (
                <Button
                  onClick={() => navigate("/dashboard")}
                  style={{ background: 'linear-gradient(to right, #273d60, #001a4d)', color: '#ffffff' }}
                >
                  Ir para Dashboard
                </Button>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="light" style={{ colorScheme: 'light' }}>
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(to bottom right, #273d60, #001a4d)' }}>
        <div className="max-w-4xl mx-auto pt-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img src={logo} alt="eonSign" className="h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#ffffff' }}>Assinatura de Documento</h1>
          </div>

          {/* Identificação */}
          {!isIdentified && (
            <Card className="p-6 mb-6" style={{ backgroundColor: '#ffffff' }}>
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#111827' }}>Identificação</h2>
              <p className="text-sm mb-4" style={{ color: '#6b7280' }}>Por favor, informe seu e-mail para acessar o documento</p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" style={{ color: '#374151' }}>E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="seu@email.com"
                    maxLength={255}
                    className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                  />
                  {emailError && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{emailError}</p>}
                </div>
                <Button
                  onClick={handleIdentify}
                  disabled={isLoading || !email || !!emailError}
                  className="w-full"
                  style={{ background: 'linear-gradient(to right, #273d60, #001a4d)', color: '#ffffff' }}
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
              {/* Location Status Alert for Simple Signatures */}
              {isSimpleSignature && !location && (
                <Card className="p-4 mb-6 border-amber-500" style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b' }}>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                    <div className="flex-1">
                      <h4 className="font-medium mb-1" style={{ color: '#92400e' }}>Localização Obrigatória</h4>
                      <p className="text-sm mb-3" style={{ color: '#b45309' }}>
                        {locationRequesting 
                          ? "Obtendo sua localização..." 
                          : locationError 
                            ? "Não foi possível obter sua localização. Clique no botão abaixo para tentar novamente."
                            : "Por favor, permita o acesso à sua localização para assinar este documento."}
                      </p>
                      {locationError && (
                        <Button
                          onClick={requestLocation}
                          variant="outline"
                          size="sm"
                          style={{ borderColor: '#f59e0b', color: '#92400e' }}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Permitir Localização
                        </Button>
                      )}
                      {locationRequesting && (
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#d97706' }} />
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Location Confirmed */}
              {isSimpleSignature && location && (
                <Card className="p-4 mb-6" style={{ backgroundColor: '#f0fdf4', borderColor: '#22c55e' }}>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5" style={{ color: '#16a34a' }} />
                    <p className="text-sm font-medium" style={{ color: '#166534' }}>
                      Localização capturada com sucesso
                    </p>
                  </div>
                </Card>
              )}

              {/* PDF Viewer */}
              <Card className="p-6 mb-6" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold" style={{ color: '#111827' }}>Visualizar Documento</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8" title="Diminuir zoom">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-sm min-w-[3rem] text-center" style={{ color: '#6b7280' }}>
                      {Math.round(pdfScale * 100)}%
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8" title="Aumentar zoom">
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
                  <div
                    ref={pdfContainerRef}
                    className="relative overflow-auto border rounded-md"
                    style={{ height: "calc(100vh - 380px)", minHeight: "400px", backgroundColor: '#f3f4f6' }}
                  >
                    <iframe
                      src={`${document.file_url}#view=Fit&zoom=page-fit`}
                      className="w-full h-full border-0"
                      title="Document Preview"
                    />
                  </div>
                ) : (
                  <p style={{ color: '#6b7280' }}>Documento não disponível para visualização</p>
                )}
              </Card>

              <Card className="p-6 mb-6" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex items-start gap-4">
                  <FileText className="h-8 w-8 flex-shrink-0" style={{ color: '#273d60' }} />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2" style={{ color: '#111827' }}>{document.name}</h2>
                    <div className="flex items-center gap-2 text-sm flex-wrap" style={{ color: '#6b7280' }}>
                      <span>Status: {getStatusBadge(document.status)}</span>
                      <span>•</span>
                      <span>
                        Assinaturas: {document.signed_by}/{document.signers}
                      </span>
                      {isSimpleSignature && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>Assinatura Eletrônica</Badge>
                        </>
                      )}
                      {requiresFacialBiometry && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                            <Camera className="h-3 w-3 mr-1" />
                            Biometria Facial
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Signatários */}
              <Card className="p-6 mb-6" style={{ backgroundColor: '#ffffff' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#111827' }}>Signatários</h3>
                <div className="space-y-3">
                  {signers.map((signer) => (
                    <div key={signer.id} className="flex items-center justify-between p-3 rounded-md" style={{ backgroundColor: '#f3f4f6' }}>
                      <div>
                        <p className="font-medium" style={{ color: '#111827' }}>{signer.name}</p>
                        <p className="text-sm" style={{ color: '#6b7280' }}>
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
                <Card className="p-6" style={{ backgroundColor: '#ffffff' }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: '#111827' }}>Assinar Documento</h3>
                  <div className="space-y-4">
                    {/* Certificate info for ADVANCED/QUALIFIED modes */}
                    {!isSimpleSignature && (
                      <div className="p-4 border rounded-lg" style={{ background: 'linear-gradient(to right, #eff6ff, #eef2ff)', borderColor: '#bfdbfe' }}>
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: '#dbeafe' }}>
                            <ShieldCheck className="h-5 w-5" style={{ color: '#2563eb' }} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1" style={{ color: '#1e3a8a' }}>
                              {document.signature_mode === "QUALIFIED"
                                ? "Assinatura Qualificada (ICP-Brasil)"
                                : "Assinatura Avançada"}
                            </h4>
                            <p className="text-sm mb-3" style={{ color: '#1d4ed8' }}>
                              {document.signature_mode === "QUALIFIED"
                                ? "Este documento requer um certificado digital ICP-Brasil para assinatura com validade jurídica máxima."
                                : "Este documento requer um certificado digital em nuvem para assinatura avançada."}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open("https://certifica.eonhub.com.br", "_blank")}
                                style={{ borderColor: '#93c5fd', color: '#1d4ed8' }}
                              >
                                <Award className="h-4 w-4 mr-2" />
                                Adquirir Certificado Digital
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Typed Signature for Simple Mode */}
                    {isSimpleSignature && (
                      <div>
                        <Label htmlFor="typedSignature" className="flex items-center gap-2" style={{ color: '#374151' }}>
                          <PenLine className="h-4 w-4" />
                          Digite sua assinatura
                        </Label>
                        <Input
                          id="typedSignature"
                          value={typedSignature}
                          onChange={(e) => setTypedSignature(e.target.value)}
                          placeholder="Seu nome completo"
                          className="mt-1"
                          style={{ backgroundColor: '#ffffff', color: '#111827' }}
                        />
                      </div>
                    )}

                    {/* Selfie Capture for Simple Mode with Facial Biometry */}
                    {isSimpleSignature && requiresFacialBiometry && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2" style={{ color: '#374151' }}>
                          <Camera className="h-4 w-4" />
                          Biometria Facial (Obrigatória)
                        </Label>
                        {selfieBase64 ? (
                          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid #22c55e' }}>
                            <CheckCircle className="h-5 w-5" style={{ color: '#16a34a' }} />
                            <span className="text-sm font-medium" style={{ color: '#166534' }}>Selfie capturada</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowSelfieDialog(true)}
                              className="ml-auto"
                            >
                              Capturar Novamente
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowSelfieDialog(true)}
                            className="w-full"
                            style={{ borderColor: '#3b82f6', color: '#1d4ed8' }}
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Capturar Selfie
                          </Button>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="cpf" style={{ color: '#374151' }}>CPF/CNPJ</Label>
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
                          style={{ backgroundColor: '#ffffff', color: '#111827' }}
                        />
                        {cpfValid === false && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>CPF/CNPJ inválido</p>}
                        {cpfValid === true && <p className="text-xs mt-1" style={{ color: '#16a34a' }}>✓ CPF/CNPJ válido</p>}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="birthDate" style={{ color: '#374151' }}>Data de Nascimento</Label>
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
                          return today.toISOString().split("T")[0];
                        })()}
                        className={birthDateError ? "border-red-500 focus-visible:ring-red-500" : ""}
                        style={{ backgroundColor: '#ffffff', color: '#111827' }}
                      />
                      {birthDateError ? (
                        <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{birthDateError}</p>
                      ) : (
                        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Você deve ter pelo menos 18 anos</p>
                      )}
                    </div>
                    <Button
                      onClick={handleSign}
                      disabled={
                        isSigning ||
                        !cpf ||
                        !birthDate ||
                        cpfValid === false ||
                        !!birthDateError ||
                        (isSimpleSignature && !typedSignature.trim()) ||
                        (isSimpleSignature && !location) ||
                        (isSimpleSignature && requiresFacialBiometry && !selfieBase64)
                      }
                      className="w-full"
                      style={{ background: 'linear-gradient(to right, #273d60, #001a4d)', color: '#ffffff' }}
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
                <Card className="p-6 text-center" style={{ backgroundColor: '#ffffff' }}>
                  <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: '#15803d' }} />
                  <p className="text-lg font-medium" style={{ color: '#111827' }}>Você já assinou este documento</p>
                  <p className="text-sm mt-2" style={{ color: '#6b7280' }}>
                    Assinado em {new Date(currentSigner.signed_at!).toLocaleString("pt-BR")}
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selfie Capture Dialog */}
      <SelfieCaptureDialog
        open={showSelfieDialog}
        onOpenChange={setShowSelfieDialog}
        onCapture={handleSelfieCapture}
        signerName={currentSigner?.name || ""}
      />
    </div>
  );
};

export default SignDocument;
