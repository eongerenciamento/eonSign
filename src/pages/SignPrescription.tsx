import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { BrySigningDialog } from "@/components/documents/BrySigningDialog";
import { FileText, CloudUpload, Key, CheckCircle, Send, AlertCircle, Upload, Eye, EyeOff, Loader2 } from "lucide-react";
import logoGray from "@/assets/logo-eon-gray.png";

interface DocumentData {
  id: string;
  name: string;
  patientName: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  status: string;
  brySignerLink: string | null;
  signedBy: number;
  signers: number;
}

const SignPrescription = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [showBryDialog, setShowBryDialog] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  
  // A1 Certificate states
  const [showA1Upload, setShowA1Upload] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningA1, setIsSigningA1] = useState(false);

  useEffect(() => {
    const loadDocument = async () => {
      if (!documentId) return;

      try {
        // Get document with patient info
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('id, name, patient_name, status, signed_by, signers')
          .eq('id', documentId)
          .single();

        if (docError) throw docError;

        // Get company signer to find BRy link
        const { data: signerData } = await supabase
          .from('document_signers')
          .select('bry_signer_link, status')
          .eq('document_id', documentId)
          .eq('is_company_signer', true)
          .single();

        // Get patient contact info from patients table using patient_name
        let patientPhone = null;
        let patientEmail = null;
        
        if (docData.patient_name) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: patientData } = await supabase
              .from('patients')
              .select('phone, email')
              .eq('user_id', user.id)
              .eq('name', docData.patient_name)
              .single();
            
            if (patientData) {
              patientPhone = patientData.phone;
              patientEmail = patientData.email;
            }
          }
        }

        const signedStatus = signerData?.status === 'signed' || docData.signed_by > 0;

        setDocument({
          id: docData.id,
          name: docData.name,
          patientName: docData.patient_name,
          patientPhone,
          patientEmail,
          status: docData.status,
          brySignerLink: signerData?.bry_signer_link || null,
          signedBy: docData.signed_by,
          signers: docData.signers
        });

        setIsSigned(signedStatus);
      } catch (error) {
        console.error('Error loading document:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o documento.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId, toast]);

  const handleOpenCloudCertificate = () => {
    if (document?.brySignerLink) {
      setShowBryDialog(true);
    } else {
      toast({
        title: "Link não disponível",
        description: "O link de assinatura ainda não está disponível. Aguarde alguns segundos e tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleSigningComplete = () => {
    setIsSigned(true);
    setShowBryDialog(false);
    toast({
      title: "Prescrição assinada!",
      description: "Agora você pode enviar para o paciente."
    });
  };

  const handleCertificateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.pfx', '.p12'];
      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(extension)) {
        toast({
          title: "Formato inválido",
          description: "Selecione um arquivo .pfx ou .p12",
          variant: "destructive"
        });
        return;
      }
      
      setCertificateFile(file);
    }
  };

  const handleSignWithA1 = async () => {
    if (!certificateFile || !certificatePassword) {
      toast({
        title: "Dados incompletos",
        description: "Selecione o certificado e informe a senha.",
        variant: "destructive"
      });
      return;
    }

    setIsSigningA1(true);

    try {
      // Read certificate file as base64
      const fileReader = new FileReader();
      const certificateBase64 = await new Promise<string>((resolve, reject) => {
        fileReader.onload = () => {
          const result = fileReader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        fileReader.onerror = reject;
        fileReader.readAsDataURL(certificateFile);
      });

      // Call edge function to sign with A1 certificate
      const { data, error } = await supabase.functions.invoke('sign-with-a1-certificate', {
        body: {
          documentId: document?.id,
          certificateBase64,
          certificatePassword
        }
      });

      if (error) throw error;

      if (data?.success) {
        setIsSigned(true);
        setShowA1Upload(false);
        toast({
          title: "Prescrição assinada!",
          description: "Sua assinatura digital foi aplicada com sucesso."
        });
      } else {
        throw new Error(data?.error || "Erro ao assinar documento");
      }

    } catch (error: any) {
      console.error('Error signing with A1:', error);
      toast({
        title: "Erro ao assinar",
        description: error.message || "Verifique a senha do certificado e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSigningA1(false);
    }
  };

  const handleSendToPatient = async () => {
    if (!document) return;

    const hasContact = document.patientPhone || document.patientEmail;
    if (!hasContact) {
      toast({
        title: "Sem contato",
        description: "O paciente não possui telefone ou e-mail cadastrado.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get company info
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('company_name, admin_name')
        .eq('user_id', user.id)
        .single();

      // Send prescription to patient via edge function
      const { error } = await supabase.functions.invoke('send-prescription-to-patient', {
        body: {
          documentId: document.id,
          documentName: document.name,
          patientName: document.patientName,
          patientPhone: document.patientPhone,
          patientEmail: document.patientEmail,
          organizationName: companyData?.company_name || 'Eon Sign',
          senderName: companyData?.admin_name || 'Profissional de Saúde',
          userId: user.id
        }
      });

      if (error) throw error;

      setIsSent(true);
      toast({
        title: "Prescrição enviada!",
        description: "O paciente receberá a prescrição por " + 
          (document.patientEmail && document.patientPhone ? "e-mail e WhatsApp" : 
           document.patientEmail ? "e-mail" : "WhatsApp") + "."
      });

      // Navigate after short delay
      setTimeout(() => {
        navigate('/documentos');
      }, 2000);

    } catch (error: any) {
      console.error('Error sending prescription:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a prescrição.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Documento não encontrado</CardTitle>
            <CardDescription>
              A prescrição que você está procurando não existe ou você não tem permissão para acessá-la.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/documentos')}>
              Voltar aos Documentos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <img src={logoGray} alt="Eon Sign" className="h-8 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Assinar Prescrição</h1>
            <p className="text-gray-600 mt-1">Assine digitalmente e envie ao paciente</p>
          </div>
        </div>

        {/* Document Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{document.name}</CardTitle>
                {document.patientName && (
                  <CardDescription className="text-purple-600 font-medium">
                    Paciente: {document.patientName}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Signing Options */}
        {!isSigned ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assine com Certificado Digital</CardTitle>
              <CardDescription>
                Escolha como deseja assinar sua prescrição médica (ICP-Brasil)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!showA1Upload ? (
                <>
                  <Button
                    onClick={handleOpenCloudCertificate}
                    className="w-full justify-start gap-3 h-auto py-4 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90"
                  >
                    <CloudUpload className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-semibold">Certificado em Nuvem</p>
                      <p className="text-xs opacity-80">Assinar com certificado digital na nuvem</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setShowA1Upload(true)}
                    className="w-full justify-start gap-3 h-auto py-4"
                  >
                    <Key className="w-5 h-5 text-gray-500" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-700">Upload de Certificado A1</p>
                      <p className="text-xs text-gray-500">Fazer upload do arquivo .pfx ou .p12</p>
                    </div>
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-700">Upload de Certificado A1</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setShowA1Upload(false);
                        setCertificateFile(null);
                        setCertificatePassword("");
                      }}
                      className="text-gray-500"
                    >
                      Voltar
                    </Button>
                  </div>

                  {/* Certificate File Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="certificate">Arquivo do Certificado (.pfx ou .p12)</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="certificate"
                      accept=".pfx,.p12"
                      onChange={handleCertificateFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full justify-start gap-2 h-auto py-3"
                    >
                      <Upload className="w-4 h-4" />
                      {certificateFile ? (
                        <span className="truncate">{certificateFile.name}</span>
                      ) : (
                        <span className="text-gray-500">Selecionar arquivo...</span>
                      )}
                    </Button>
                  </div>

                  {/* Certificate Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha do Certificado</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={certificatePassword}
                        onChange={(e) => setCertificatePassword(e.target.value)}
                        placeholder="Digite a senha do certificado"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-500" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Sign Button */}
                  <Button
                    onClick={handleSignWithA1}
                    disabled={!certificateFile || !certificatePassword || isSigningA1}
                    className="w-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90"
                  >
                    {isSigningA1 ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Assinando...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4 mr-2" />
                        Assinar com Certificado A1
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Success State - Send to Patient */
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <CardTitle className="text-green-800">Prescrição Assinada!</CardTitle>
                  <CardDescription className="text-green-700">
                    Sua assinatura digital foi aplicada com sucesso
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(document.patientPhone || document.patientEmail) && !isSent ? (
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600 mb-2">Enviar prescrição para:</p>
                    <p className="font-medium text-gray-800">{document.patientName}</p>
                    {document.patientEmail && (
                      <p className="text-sm text-gray-500">📧 {document.patientEmail}</p>
                    )}
                    {document.patientPhone && (
                      <p className="text-sm text-gray-500">📱 {document.patientPhone}</p>
                    )}
                  </div>
                  
                  <Button
                    onClick={handleSendToPatient}
                    disabled={isSending}
                    className="w-full gap-2 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90"
                  >
                    <Send className="w-4 h-4" />
                    {isSending ? "Enviando..." : "Enviar ao Paciente"}
                  </Button>
                </div>
              ) : isSent ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-800 font-medium">Prescrição enviada com sucesso!</p>
                  <p className="text-sm text-gray-600 mt-1">Redirecionando...</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-600">O paciente não possui contato cadastrado.</p>
                  <Button
                    onClick={() => navigate('/documentos')}
                    variant="outline"
                    className="mt-4"
                  >
                    Ir para Documentos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Back Button */}
        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate('/documentos')}>
            Voltar para Documentos
          </Button>
        </div>
      </div>

      {/* BRy Signing Dialog */}
      {document?.brySignerLink && (
        <BrySigningDialog
          open={showBryDialog}
          onOpenChange={setShowBryDialog}
          signingUrl={document.brySignerLink}
          documentName={document.name}
          documentId={document.id}
          onSigningComplete={handleSigningComplete}
        />
      )}
    </div>
  );
};

export default SignPrescription;