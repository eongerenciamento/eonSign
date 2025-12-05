import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  FileText,
  ClipboardList,
  FileUp,
  Video,
  Award,
  PartyPopper,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CertificatePurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signerId?: string;
  documentId?: string;
  prefillData?: {
    name?: string;
    cpf?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    type?: "PF" | "PJ";
    cnpj?: string;
    responsibleName?: string;
    certificateRequestId?: string;
  };
}

type Step = "form" | "document" | "videoconference" | "emission" | "complete";

const STEPS_CONFIG = [
  { key: "form", label: "Dados", icon: ClipboardList },
  { key: "document", label: "Documento", icon: FileUp },
  { key: "videoconference", label: "Vídeo", icon: Video },
  { key: "emission", label: "Emissão", icon: Award },
  { key: "complete", label: "Concluído", icon: PartyPopper },
] as const;

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export function CertificatePurchaseDialog({
  open,
  onOpenChange,
  signerId,
  documentId,
  prefillData,
}: CertificatePurchaseDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [type, setType] = useState<"PF" | "PJ">("PF");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [canIssue, setCanIssue] = useState<boolean | null>(null);

  // Form fields
  const [commonName, setCommonName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  
  // PJ fields
  const [cnpj, setCnpj] = useState("");
  const [responsibleName, setResponsibleName] = useState("");

  // Document upload
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Videoconference iframe
  const [showVideoconferenceIframe, setShowVideoconferenceIframe] = useState(false);
  const [isVideoconferenceLoading, setIsVideoconferenceLoading] = useState(true);

  // Emission iframe
  const [showEmissionIframe, setShowEmissionIframe] = useState(false);
  const [isEmissionLoading, setIsEmissionLoading] = useState(true);

  const currentStepIndex = STEPS_CONFIG.findIndex((s) => s.key === step);

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open) {
      console.log("[CertificateDialog] Dialog opened, initializing...");
      setInitError(null);
      setIsInitializing(true);
      
      const initializeDialog = async () => {
        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          
          if (authError) {
            console.error("[CertificateDialog] Auth error:", authError);
            setInitError("Erro de autenticação. Por favor, faça login novamente.");
            return;
          }
          
          if (!user) {
            console.error("[CertificateDialog] No user found");
            setInitError("Usuário não autenticado. Por favor, faça login.");
            return;
          }
          
          console.log("[CertificateDialog] User authenticated:", user.id);
          
          if (prefillData) {
            console.log("[CertificateDialog] Setting prefill data:", prefillData);
            setCommonName(prefillData.name || "");
            setCpf(prefillData.cpf || "");
            setEmail(prefillData.email || "");
            setPhone(prefillData.phone || "");
            setBirthDate(prefillData.birthDate || "");
            if (prefillData.type) setType(prefillData.type);
            if (prefillData.cnpj) setCnpj(prefillData.cnpj);
            if (prefillData.responsibleName) setResponsibleName(prefillData.responsibleName);
            
            // If continuing from paid certificate, skip to document step
            if (prefillData.certificateRequestId) {
              setStep("document");
            }
          }
          
          console.log("[CertificateDialog] Initialization complete");
        } catch (error: any) {
          console.error("[CertificateDialog] Initialization error:", error);
          setInitError(error.message || "Erro ao inicializar. Tente novamente.");
        } finally {
          setIsInitializing(false);
        }
      };
      
      initializeDialog();
    }
  }, [open, prefillData]);

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .slice(0, 14);
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})/, "$1-$2")
      .slice(0, 18);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{2})(\d)/, "($1)$2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 14);
  };

  const formatBirthDate = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{2})(\d)/, "$1/$2")
      .replace(/(\d{2})(\d)/, "$1/$2")
      .slice(0, 10);
  };

  const checkPsbio = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("bry-ar-check-psbio", {
        body: { cpf: cpf.replace(/\D/g, "") },
      });

      if (error) throw error;
      setCanIssue(data.can_issue);
      return data.can_issue;
    } catch (error: any) {
      console.error("[CertificateDialog] PSBIO check error:", error);
      return null;
    }
  };

  const handleSubmitRequest = async () => {
    if (!commonName || !cpf || !email || !phone || !birthDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (type === "PJ" && (!cnpj || !responsibleName)) {
      toast.error("Preencha CNPJ e nome do responsável para certificado PJ");
      return;
    }

    setIsLoading(true);

    try {
      await checkPsbio();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
      }

      const requestBody: any = {
        type,
        common_name: commonName,
        cpf: cpf.replace(/\D/g, ""),
        email,
        phone: phone.replace(/\D/g, ""),
        holder_birthdate: birthDate.replace(/\D/g, ""),
        user_id: user.id,
        signer_id: signerId,
        document_id: documentId,
      };

      if (type === "PJ") {
        requestBody.cnpj = cnpj.replace(/\D/g, "");
        requestBody.responsible_name = responsibleName;
      }

      console.log("[CertificateDialog] Sending request:", requestBody);

      const { data, error } = await supabase.functions.invoke("bry-ar-request-certificate", {
        body: requestBody,
      });

      if (error) {
        console.error("[CertificateDialog] Function error:", error);
        throw error;
      }

      console.log("[CertificateDialog] Response:", data);

      if (!data.success) {
        throw new Error(data.error || "Erro ao solicitar certificado");
      }

      setProtocol(data.protocol);
      toast.success("Solicitação enviada com sucesso!");
      setStep("document");
    } catch (error: any) {
      console.error("[CertificateDialog] Certificate request error:", error);
      toast.error(error.message || "Erro ao solicitar certificado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!documentFile || !protocol) {
      toast.error("Selecione um documento para enviar");
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(documentFile);
      const base64 = await base64Promise;

      const extension = documentFile.name.split(".").pop()?.toLowerCase() || "pdf";

      const { data, error } = await supabase.functions.invoke("bry-ar-attach-document", {
        body: {
          protocol,
          document_type: "identity_document",
          document_name: documentFile.name,
          document_base64: base64,
          file_extension: extension,
        },
      });

      if (error) throw error;

      toast.success("Documento anexado com sucesso!");
      setStep("videoconference");
    } catch (error: any) {
      console.error("[CertificateDialog] Document upload error:", error);
      toast.error(error.message || "Erro ao enviar documento");
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenVideoconference = () => {
    if (!protocol || !cpf) return;
    setShowVideoconferenceIframe(true);
    setIsVideoconferenceLoading(true);
  };

  const handleCloseVideoconference = () => {
    setShowVideoconferenceIframe(false);
    setIsVideoconferenceLoading(true);
  };

  const handleCompleteVideoconference = () => {
    setShowVideoconferenceIframe(false);
    setIsVideoconferenceLoading(true);
    setStep("emission");
  };

  const videoconferenceUrl = protocol && cpf 
    ? `https://certificaminas.syngularid.com.br/lyve?protocolo=${protocol}&cpf=${cpf.replace(/\D/g, "")}`
    : null;

  const emissionUrl = protocol && cpf 
    ? `https://mp-universal.hom.bry.com.br/protocolo/emissao?cpf=${cpf.replace(/\D/g, "")}&protocolo=${protocol}`
    : null;

  const handleOpenEmission = () => {
    if (!protocol || !cpf) return;
    setShowEmissionIframe(true);
    setIsEmissionLoading(true);
  };

  const handleCloseEmission = () => {
    setShowEmissionIframe(false);
    setIsEmissionLoading(true);
  };

  const handleCompleteEmission = () => {
    setShowEmissionIframe(false);
    setIsEmissionLoading(true);
    setStep("complete");
  };

  const resetDialog = () => {
    setStep("form");
    setProtocol(null);
    setCanIssue(null);
    setDocumentFile(null);
    setCommonName("");
    setCpf("");
    setEmail("");
    setPhone("");
    setBirthDate("");
    setCnpj("");
    setResponsibleName("");
    setInitError(null);
    setShowVideoconferenceIframe(false);
    setIsVideoconferenceLoading(true);
    setShowEmissionIframe(false);
    setIsEmissionLoading(true);
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    console.log("[CertificateDialog] onOpenChange called:", newOpen, {
      isLoading,
      isUploading,
      isInitializing,
      step
    });
    
    if (!newOpen && (isLoading || isUploading || isInitializing)) {
      console.log("[CertificateDialog] Prevented close during loading state");
      return;
    }
    
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  const handleInteractOutside = (e: Event) => {
    if (isLoading || isUploading || isInitializing) {
      console.log("[CertificateDialog] Prevented interact outside during loading");
      e.preventDefault();
    }
  };

  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    if (isLoading || isUploading || isInitializing) {
      console.log("[CertificateDialog] Prevented escape during loading");
      e.preventDefault();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange} modal={true}>
        <DialogContent 
          className={cn(
            "overflow-hidden",
            (showVideoconferenceIframe || showEmissionIframe)
              ? "max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col" 
              : "sm:max-w-[550px] max-h-[90vh] overflow-y-auto"
          )}
          onInteractOutside={handleInteractOutside}
          onEscapeKeyDown={handleEscapeKeyDown}
          onPointerDownOutside={handleInteractOutside}
        >
          {showVideoconferenceIframe ? (
            <>
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold">Videoconferência</h2>
                  <p className="text-xs text-muted-foreground">Realize a validação de identidade</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCloseVideoconference}>
                    Voltar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleCompleteVideoconference}
                    className="bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Concluir Videoconferência
                  </Button>
                </div>
              </div>
              <div className="relative flex-1 w-full min-h-0">
                {isVideoconferenceLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Carregando videoconferência...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={videoconferenceUrl || ""}
                  className="w-full h-full border-0"
                  style={{ minHeight: "calc(90vh - 80px)" }}
                  allow="camera; microphone; display-capture"
                  onLoad={() => setIsVideoconferenceLoading(false)}
                />
              </div>
            </>
          ) : showEmissionIframe ? (
            <>
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold">Emissão do Certificado</h2>
                  <p className="text-xs text-muted-foreground">Complete o processo de emissão</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCloseEmission}>
                    Voltar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleCompleteEmission}
                    className="bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Concluir Emissão
                  </Button>
                </div>
              </div>
              <div className="relative flex-1 w-full min-h-0">
                {isEmissionLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Carregando ambiente de emissão...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={emissionUrl || ""}
                  className="w-full h-full border-0"
                  style={{ minHeight: "calc(90vh - 80px)" }}
                  allow="camera; microphone"
                  onLoad={() => setIsEmissionLoading(false)}
                />
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="pb-2">
                <DialogTitle className="text-lg">Certificado Digital A1</DialogTitle>
                <DialogDescription className="text-xs">
                  Solicite seu certificado digital ICP-Brasil
                </DialogDescription>
              </DialogHeader>

        {/* Step Indicator */}
        {!isInitializing && !initError && (
          <div className="flex items-center justify-between px-2 py-4 mb-2">
            {STEPS_CONFIG.map((stepItem, index) => {
              const Icon = stepItem.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={stepItem.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1.1 : 1,
                        backgroundColor: isCompleted 
                          ? "hsl(var(--primary))" 
                          : isCurrent 
                            ? "hsl(var(--primary))" 
                            : "hsl(var(--muted))",
                      }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        (isCompleted || isCurrent) ? "shadow-md" : ""
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5 text-primary-foreground" />
                      ) : (
                        <Icon className={cn(
                          "w-5 h-5",
                          isCurrent ? "text-primary-foreground" : "text-muted-foreground"
                        )} />
                      )}
                    </motion.div>
                    <span className={cn(
                      "text-[10px] mt-1.5 font-medium transition-colors",
                      isCurrent ? "text-primary" : isCompleted ? "text-primary" : "text-muted-foreground"
                    )}>
                      {stepItem.label}
                    </span>
                  </div>
                  
                  {index < STEPS_CONFIG.length - 1 && (
                    <div className="flex-1 mx-1">
                      <div className="h-0.5 bg-muted relative overflow-hidden rounded-full">
                        <motion.div
                          initial={false}
                          animate={{ 
                            width: isCompleted ? "100%" : "0%" 
                          }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                          className="absolute top-0 left-0 h-full bg-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Loading state */}
        {isInitializing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </motion.div>
        )}

        {/* Error state */}
        {initError && !isInitializing && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Erro</p>
                <p className="text-sm text-destructive/80">{initError}</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step Content with Animations */}
        <AnimatePresence mode="wait">
          {/* Form step */}
          {step === "form" && !isInitializing && !initError && (
            <motion.div
              key="form"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs text-muted-foreground">Tipo de Certificado</Label>
                <RadioGroup
                  value={type}
                  onValueChange={(value) => setType(value as "PF" | "PJ")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PF" id="pf" />
                    <Label htmlFor="pf" className="cursor-pointer">Pessoa Física</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PJ" id="pj" />
                    <Label htmlFor="pj" className="cursor-pointer">Pessoa Jurídica</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="commonName" className="text-xs text-muted-foreground">
                  {type === "PF" ? "Nome Completo" : "Razão Social"} *
                </Label>
                <Input
                  id="commonName"
                  value={commonName}
                  onChange={(e) => setCommonName(e.target.value)}
                  placeholder={type === "PF" ? "João da Silva" : "Empresa LTDA"}
                />
              </div>

              <div>
                <Label htmlFor="cpf" className="text-xs text-muted-foreground">CPF do Titular *</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>

              {type === "PJ" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div>
                    <Label htmlFor="cnpj" className="text-xs text-muted-foreground">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="responsibleName" className="text-xs text-muted-foreground">Nome do Responsável *</Label>
                    <Input
                      id="responsibleName"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      placeholder="Nome do responsável legal"
                    />
                  </div>
                </motion.div>
              )}

              <div>
                <Label htmlFor="email" className="text-xs text-muted-foreground">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-xs text-muted-foreground">Telefone *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00)00000-0000"
                />
              </div>

              <div>
                <Label htmlFor="birthDate" className="text-xs text-muted-foreground">Data de Nascimento *</Label>
                <Input
                  id="birthDate"
                  value={birthDate}
                  onChange={(e) => setBirthDate(formatBirthDate(e.target.value))}
                  placeholder="DD/MM/AAAA"
                />
              </div>


              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmitRequest} 
                  disabled={isLoading}
                  className="bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Continuar
                </Button>
              </div>
            </motion.div>
          )}

          {/* Document step */}
          {step === "document" && (
            <motion.div
              key="document"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary font-medium">
                  Protocolo: {protocol}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Guarde este protocolo para acompanhar sua solicitação.
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Documento de Identificação *</Label>
                <p className="text-xs text-muted-foreground/70 mb-2">
                  Preferencialmente CNH exportada pelo aplicativo ou RG/DNI
                </p>
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {documentFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-foreground">{documentFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDocumentFile(null)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste o arquivo</p>
                      <p className="text-xs text-muted-foreground/70">PDF, JPG ou PNG</p>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </motion.div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep("videoconference")}>
                  Pular
                </Button>
                <Button 
                  onClick={handleUploadDocument} 
                  disabled={!documentFile || isUploading}
                  className="bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                >
                  {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar
                </Button>
              </div>
            </motion.div>
          )}

          {/* Videoconference step */}
          {step === "videoconference" && (
            <motion.div
              key="videoconference"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-700">Solicitação enviada!</p>
                  <p className="text-sm text-green-600/80">
                    Realize a videoconferência para validar sua identidade.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">
                  Clique no botão abaixo para acessar o ambiente de videoconferência. 
                  Tenha em mãos seu documento de identificação.
                </p>
                <Button 
                  onClick={handleOpenVideoconference}
                  className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Iniciar Videoconferência
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setStep("emission")}
                >
                  Já realizei
                </Button>
              </div>
            </motion.div>
          )}

          {/* Emission step */}
          {step === "emission" && (
            <motion.div
              key="emission"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-foreground">
                  Após a aprovação da sua solicitação (você receberá uma notificação), 
                  clique no botão abaixo para emitir seu certificado.
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <Button 
                  onClick={handleOpenEmission}
                  className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                >
                  <Award className="w-4 h-4 mr-2" />
                  Emitir Certificado
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          )}

          {/* Complete step */}
          {step === "complete" && (
            <motion.div
              key="complete"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="flex flex-col items-center py-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <PartyPopper className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Processo Concluído!</h3>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Siga as instruções na página de emissão para baixar e instalar seu certificado digital.
                </p>
              </motion.div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-foreground">
                  <strong>Protocolo:</strong> {protocol}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Guarde este protocolo para referência futura.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <Button 
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    window.location.href = "/certificados";
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Acompanhar Solicitação
                </Button>
                <Button 
                  onClick={() => onOpenChange(false)}
                  className="bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                >
                  Concluir
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
            </>
          )}
      </DialogContent>
    </Dialog>
  );
}
