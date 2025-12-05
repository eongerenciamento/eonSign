import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, ExternalLink, Download, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type CertificateType = "PF" | "PJ";
type Step = "form" | "upload" | "videoconference" | "issue" | "complete";

interface PSBioStatus {
  videoconference_issue_enabled: boolean;
  local_biometry: boolean;
}

export default function CertificatePurchase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<Step>("form");
  const [certificateType, setCertificateType] = useState<CertificateType>("PF");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [psbioStatus, setPsbioStatus] = useState<PSBioStatus | null>(null);
  const [videoconferenceUrl, setVideoconferenceUrl] = useState<string | null>(null);
  
  // Form fields
  const [commonName, setCommonName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('admin_name, admin_email, admin_phone, admin_cpf')
          .eq('user_id', user.id)
          .single();
        
        if (companyData) {
          setCommonName(companyData.admin_name || "");
          setEmail(companyData.admin_email || user.email || "");
          setPhone(companyData.admin_phone || "");
          setCpf(companyData.admin_cpf || "");
        }
      }
    };
    loadUserData();
  }, []);

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 14);
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1)$2-$3");
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1)$2-$3");
  };

  const formatBirthDate = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    return numbers.replace(/(\d{2})(\d{2})(\d{4})/, "$1/$2/$3");
  };

  const checkPSBio = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    
    try {
      const { data, error } = await supabase.functions.invoke('bry-ar-check-psbio', {
        body: { cpf: cleanCpf }
      });

      if (error) throw error;
      
      setPsbioStatus(data);
      return data;
    } catch (error) {
      console.error("Error checking PSBio:", error);
      return null;
    }
  };

  const handleSubmitForm = async () => {
    if (!commonName || !cpf || !email || !phone || !birthDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (certificateType === "PJ" && (!cnpj || !responsibleName)) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o CNPJ e o nome do responsável.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check PSBio status first
      const psbio = await checkPSBio();
      
      // Format birth date for API (DDMMYYYY)
      const formattedBirthDate = birthDate.replace(/\D/g, "");
      
      const requestBody: any = {
        type: certificateType,
        common_name: commonName,
        cpf: cpf.replace(/\D/g, ""),
        email,
        phone: phone.replace(/\D/g, ""),
        holder_birthdate: formattedBirthDate,
        user_id: userId,
      };

      if (certificateType === "PJ") {
        requestBody.cnpj = cnpj.replace(/\D/g, "");
        requestBody.responsible_name = responsibleName;
      }

      const { data, error } = await supabase.functions.invoke('bry-ar-request-certificate', {
        body: requestBody
      });

      if (error) throw error;

      setProtocol(data.protocol);
      
      // Determine next step based on PSBio status
      if (psbio?.local_biometry) {
        // Has local biometry, can skip videoconference
        setStep("issue");
      } else if (psbio?.videoconference_issue_enabled) {
        // Needs videoconference
        setVideoconferenceUrl(`https://videoconferencia.bfrdigital.com.br/?protocol=${data.protocol}`);
        setStep("videoconference");
      } else {
        // Default: needs document upload
        setStep("upload");
      }

      toast({
        title: "Solicitação enviada",
        description: `Protocolo: ${data.protocol}`,
      });
    } catch (error: any) {
      console.error("Error submitting certificate request:", error);
      toast({
        title: "Erro ao solicitar certificado",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image') && !file.type.includes('pdf')) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie uma imagem ou PDF do documento.",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    setIsUploading(true);

    try {
      // TODO: Implement document upload to BRy
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulated upload
      
      toast({
        title: "Documento enviado",
        description: "Seu documento foi enviado com sucesso.",
      });
      
      if (psbioStatus?.videoconference_issue_enabled) {
        setStep("videoconference");
      } else {
        setStep("issue");
      }
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoconferenceComplete = () => {
    setStep("issue");
  };

  const handleIssueCertificate = async () => {
    setIsLoading(true);
    
    try {
      // TODO: Implement certificate issuance check
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulated check
      
      setStep("complete");
      
      toast({
        title: "Certificado emitido!",
        description: "Seu certificado digital A1 foi emitido com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro na emissão",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case "form":
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-3 block">Tipo de Certificado</Label>
              <RadioGroup
                value={certificateType}
                onValueChange={(value) => setCertificateType(value as CertificateType)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PF" id="pf" />
                  <Label htmlFor="pf" className="cursor-pointer">Pessoa Física (e-CPF)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PJ" id="pj" />
                  <Label htmlFor="pj" className="cursor-pointer">Pessoa Jurídica (e-CNPJ)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="commonName">Nome Completo *</Label>
                <Input
                  id="commonName"
                  value={commonName}
                  onChange={(e) => setCommonName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>

              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>

              {certificateType === "PJ" && (
                <>
                  <div>
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </div>
                  <div>
                    <Label htmlFor="responsibleName">Nome do Responsável Legal *</Label>
                    <Input
                      id="responsibleName"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      placeholder="Nome do responsável legal"
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00)00000-0000"
                  maxLength={14}
                />
              </div>

              <div>
                <Label htmlFor="birthDate">Data de Nascimento *</Label>
                <Input
                  id="birthDate"
                  value={birthDate}
                  onChange={(e) => setBirthDate(formatBirthDate(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                />
              </div>
            </div>

            <Button
              onClick={handleSubmitForm}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] hover:from-[#1e3050] hover:to-[#001540] text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </div>
        );

      case "upload":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Envie uma foto do seu documento de identificação (RG ou CNH)
              </p>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,.pdf"
                className="hidden"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                variant="outline"
                className="w-full h-32 border-dashed border-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Enviando...
                  </>
                ) : uploadedFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <span className="text-sm">{uploadedFile.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 mb-2" />
                    <span>Clique para enviar documento</span>
                  </div>
                )}
              </Button>
            </div>

            {protocol && (
              <p className="text-sm text-muted-foreground text-center">
                Protocolo: <strong>{protocol}</strong>
              </p>
            )}
          </div>
        );

      case "videoconference":
        return (
          <div className="space-y-6 text-center">
            <p className="text-muted-foreground">
              Para concluir a emissão do seu certificado, é necessário realizar uma videoconferência.
            </p>
            
            {videoconferenceUrl && (
              <Button
                asChild
                className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] hover:from-[#1e3050] hover:to-[#001540] text-white"
              >
                <a href={videoconferenceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Iniciar Videoconferência
                </a>
              </Button>
            )}

            <Button
              onClick={handleVideoconferenceComplete}
              variant="outline"
              className="w-full"
            >
              Já realizei a videoconferência
            </Button>

            {protocol && (
              <p className="text-sm text-muted-foreground">
                Protocolo: <strong>{protocol}</strong>
              </p>
            )}
          </div>
        );

      case "issue":
        return (
          <div className="space-y-6 text-center">
            <p className="text-muted-foreground">
              Sua solicitação está sendo processada. Clique no botão abaixo para verificar o status e emitir seu certificado.
            </p>

            <Button
              onClick={handleIssueCertificate}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] hover:from-[#1e3050] hover:to-[#001540] text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar e Emitir Certificado"
              )}
            </Button>

            {protocol && (
              <p className="text-sm text-muted-foreground">
                Protocolo: <strong>{protocol}</strong>
              </p>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-green-600">
                Certificado Emitido com Sucesso!
              </h3>
              <p className="text-muted-foreground mt-2">
                Seu certificado digital A1 foi emitido e está disponível para download.
              </p>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] hover:from-[#1e3050] hover:to-[#001540] text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Certificado
            </Button>

            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full"
            >
              Voltar ao Dashboard
            </Button>

            {protocol && (
              <p className="text-sm text-muted-foreground">
                Protocolo: <strong>{protocol}</strong>
              </p>
            )}
          </div>
        );
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "form": return "Dados do Titular";
      case "upload": return "Envio de Documento";
      case "videoconference": return "Videoconferência";
      case "issue": return "Emissão do Certificado";
      case "complete": return "Certificado Emitido";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img 
            src="/lovable-uploads/cf697ca1-b048-4c88-8e66-1659b20e2d9e.png" 
            alt="Eon Sign" 
            className="h-10 object-contain"
          />
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="bg-card rounded-xl shadow-lg border p-6">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold">Certificado Digital A1</h1>
            <p className="text-muted-foreground text-sm mt-1">R$ 109,90</p>
          </div>

          {/* Step indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className={`${step === "form" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                1. Dados
              </span>
              <span className={`${step === "upload" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                2. Documento
              </span>
              <span className={`${step === "videoconference" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                3. Validação
              </span>
              <span className={`${step === "issue" || step === "complete" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                4. Emissão
              </span>
            </div>
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#273d60] to-[#001a4d] transition-all duration-300"
                style={{ 
                  width: step === "form" ? "25%" : 
                         step === "upload" ? "50%" : 
                         step === "videoconference" ? "75%" : "100%" 
                }}
              />
            </div>
          </div>

          <h2 className="text-lg font-medium mb-4">{getStepTitle()}</h2>

          {renderStepContent()}
        </div>
      </main>
    </div>
  );
}
