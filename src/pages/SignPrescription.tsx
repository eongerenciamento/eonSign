import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { BrySigningDialog } from "@/components/documents/BrySigningDialog";
import { FileText, CloudUpload, Key, CheckCircle, Send, AlertCircle } from "lucide-react";
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
  
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [showBryDialog, setShowBryDialog] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

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
                onClick={() => toast({ title: "Em breve", description: "Upload de certificado A1 estará disponível em breve." })}
                className="w-full justify-start gap-3 h-auto py-4"
              >
                <Key className="w-5 h-5 text-gray-500" />
                <div className="text-left">
                  <p className="font-semibold text-gray-700">Upload de Certificado A1</p>
                  <p className="text-xs text-gray-500">Fazer upload do arquivo .pfx ou .p12</p>
                </div>
              </Button>
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