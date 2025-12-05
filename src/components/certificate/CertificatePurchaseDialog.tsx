import { useState, useEffect } from "react";
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
import { Loader2, Upload, CheckCircle2, AlertCircle, ExternalLink, FileText } from "lucide-react";

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
  };
}

type Step = "form" | "document" | "videoconference" | "emission" | "complete";

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

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open) {
      console.log("[CertificateDialog] Dialog opened, initializing...");
      setInitError(null);
      setIsInitializing(true);
      
      const initializeDialog = async () => {
        try {
          // Check authentication
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
          
          // Set prefill data if available
          if (prefillData) {
            console.log("[CertificateDialog] Setting prefill data:", prefillData);
            setCommonName(prefillData.name || "");
            setCpf(prefillData.cpf || "");
            setEmail(prefillData.email || "");
            setPhone(prefillData.phone || "");
            setBirthDate(prefillData.birthDate || "");
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
      // Check PSBIO first
      const psbioResult = await checkPsbio();
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
      }

      // Prepare request body
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
      // Convert file to base64
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

      // Get file extension
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
    
    const cleanCpf = cpf.replace(/\D/g, "");
    const url = `https://certificaminas.syngularid.com.br/lyve?protocolo=${protocol}&cpf=${cleanCpf}`;
    window.open(url, "_blank");
    setStep("emission");
  };

  const handleOpenEmission = () => {
    if (!protocol || !cpf) return;
    
    const cleanCpf = cpf.replace(/\D/g, "");
    // Homologation URL
    const url = `https://mp-universal.hom.bry.com.br/protocolo/emissao?cpf=${cleanCpf}&protocolo=${protocol}`;
    window.open(url, "_blank");
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
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    console.log("[CertificateDialog] onOpenChange called:", newOpen);
    if (!newOpen) {
      // Only close if user explicitly requests it
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comprar Certificado Digital A1</DialogTitle>
          <DialogDescription>
            {step === "form" && "Preencha os dados para solicitar seu certificado digital ICP-Brasil"}
            {step === "document" && "Anexe seu documento de identificação com foto"}
            {step === "videoconference" && "Realize a videoconferência para validação"}
            {step === "emission" && "Aguarde aprovação e emita seu certificado"}
            {step === "complete" && "Processo concluído!"}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isInitializing && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        )}

        {/* Error state */}
        {initError && !isInitializing && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">Erro</p>
                <p className="text-sm text-red-600">{initError}</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* Form step */}
        {step === "form" && !isInitializing && !initError && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-500">Tipo de Certificado</Label>
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
              <Label htmlFor="commonName" className="text-xs text-gray-500">
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
              <Label htmlFor="cpf" className="text-xs text-gray-500">CPF do Titular *</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>

            {type === "PJ" && (
              <>
                <div>
                  <Label htmlFor="cnpj" className="text-xs text-gray-500">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="responsibleName" className="text-xs text-gray-500">Nome do Responsável *</Label>
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
              <Label htmlFor="email" className="text-xs text-gray-500">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-xs text-gray-500">Telefone *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(00)00000-0000"
              />
            </div>

            <div>
              <Label htmlFor="birthDate" className="text-xs text-gray-500">Data de Nascimento *</Label>
              <Input
                id="birthDate"
                value={birthDate}
                onChange={(e) => setBirthDate(formatBirthDate(e.target.value))}
                placeholder="DD/MM/AAAA"
              />
            </div>

            {canIssue === false && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-700">
                  <p className="font-medium">Atenção</p>
                  <p>Cliente não cadastrado no PSBIO. Necessário CNH emitida/renovada a partir de 2018 para prosseguir.</p>
                </div>
              </div>
            )}

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
                Solicitar Certificado
              </Button>
            </div>
          </div>
        )}

        {step === "document" && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Protocolo:</strong> {protocol}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Guarde este protocolo para acompanhar sua solicitação.
              </p>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Documento de Identificação com Foto *</Label>
              <p className="text-xs text-gray-400 mb-2">
                Preferencialmente CNH exportada pelo aplicativo ou RG/DNI
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {documentFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">{documentFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDocumentFile(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Clique para selecionar ou arraste o arquivo</p>
                    <p className="text-xs text-gray-400">PDF, JPG ou PNG</p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("videoconference")}>
                Pular por agora
              </Button>
              <Button 
                onClick={handleUploadDocument} 
                disabled={!documentFile || isUploading}
                className="bg-gradient-to-r from-[#273d60] to-[#001a4d]"
              >
                {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Documento
              </Button>
            </div>
          </div>
        )}

        {step === "videoconference" && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-700">Solicitação enviada!</p>
                <p className="text-sm text-green-600">
                  Agora você precisa realizar a videoconferência para validação de identidade.
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-3">
                Clique no botão abaixo para acessar o ambiente de videoconferência. 
                Tenha em mãos seu documento de identificação.
              </p>
              <Button 
                onClick={handleOpenVideoconference}
                className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d]"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
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
                Já realizei a videoconferência
              </Button>
            </div>
          </div>
        )}

        {step === "emission" && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Após a aprovação da sua solicitação (você receberá uma notificação), 
                clique no botão abaixo para emitir seu certificado.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <Button 
                onClick={handleOpenEmission}
                className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d]"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Emitir Certificado
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-700">Processo concluído!</p>
                <p className="text-sm text-green-600">
                  Siga as instruções na página de emissão para baixar e instalar seu certificado digital.
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Protocolo:</strong> {protocol}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Guarde este protocolo para referência futura.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={() => onOpenChange(false)}
                className="bg-gradient-to-r from-[#273d60] to-[#001a4d]"
              >
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
