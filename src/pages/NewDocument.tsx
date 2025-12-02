import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
interface Signer {
  name: string;
  phone: string;
  email: string;
}
interface CompanySigner extends Signer {
  cpf: string;
  companyName: string;
}
const NewDocument = () => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [signers, setSigners] = useState<Signer[]>([{
    name: "",
    phone: "",
    email: ""
  }]);
  const [companySigner, setCompanySigner] = useState<CompanySigner | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{
    current: number;
    limit: number;
    planName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();

  // Play subtle completion sound
  const playCompletionSound = (frequency: number = 800) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Silently fail if audio is not supported
      console.log('Audio feedback not available');
    }
  };

  // Track step 1 completion (file upload)
  useEffect(() => {
    if (file !== null) {
      playCompletionSound(800); // Mid-high frequency
    }
  }, [file]);

  // Track step 2 completion (signers added)
  useEffect(() => {
    const hasCompleteSigner = signers.some(signer => signer.name && signer.phone && signer.email);
    if (hasCompleteSigner) {
      playCompletionSound(900); // Slightly higher frequency
    }
  }, [signers]);

  // Track step 3 completion (submitted)
  useEffect(() => {
    if (isSubmitted) {
      playCompletionSound(1000); // Highest frequency for final step
    }
  }, [isSubmitted]);
  useEffect(() => {
    const checkLimit = async () => {
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke("check-document-limit");
        if (error) {
          console.error("Error checking limit:", error);
          return;
        }
        if (!data.canCreate) {
          setLimitInfo({
            current: data.current,
            limit: data.limit,
            planName: data.planName
          });
          setShowLimitDialog(true);
        }
      } catch (error) {
        console.error("Error checking document limit:", error);
      }
    };
    checkLimit();
  }, []);
  useEffect(() => {
    const loadCompanySigner = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        const {
          data: companyData
        } = await supabase.from('company_settings').select('admin_name, admin_cpf, admin_phone, admin_email, company_name').eq('user_id', user.id).single();
        if (companyData) {
          setCompanySigner({
            name: companyData.admin_name,
            cpf: companyData.admin_cpf,
            phone: companyData.admin_phone,
            email: companyData.admin_email,
            companyName: companyData.company_name
          });
        }
      }
    };
    loadCompanySigner();
  }, []);
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos PDF.",
          variant: "destructive"
        });
      }
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos PDF.",
          variant: "destructive"
        });
      }
    }
  };
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)})${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)})${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };
  const handleSignerChange = (index: number, field: keyof Signer, value: string) => {
    const newSigners = [...signers];
    if (field === "phone") {
      newSigners[index][field] = formatPhone(value);
    } else {
      newSigners[index][field] = value;
    }
    setSigners(newSigners);
  };
  const addSigner = () => {
    setSigners([...signers, {
      name: "",
      phone: "",
      email: ""
    }]);
  };
  const removeSigner = (index: number) => {
    if (signers.length > 1) {
      setSigners(signers.filter((_, i) => i !== index));
    }
  };
  const handleSubmit = async () => {
    if (!file || !title) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o título e selecione um arquivo.",
        variant: "destructive"
      });
      return;
    }
    const hasEmptySigner = signers.some(signer => !signer.name || !signer.phone || !signer.email);
    if (hasEmptySigner) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos dos signatários.",
        variant: "destructive"
      });
      return;
    }
    if (!companySigner) {
      toast({
        title: "Erro",
        description: "Configure os dados da empresa antes de enviar documentos.",
        variant: "destructive"
      });
      return;
    }
    try {
      // Get current user
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Upload PDF to storage
      const timestamp = Date.now();
      // Sanitize filename: remove special characters, spaces, and accents
      const sanitizedFileName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars and spaces with underscore
      .replace(/__+/g, '_'); // Replace multiple underscores with single
      const filePath = `${user.id}/${timestamp}-${sanitizedFileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('documents').getPublicUrl(filePath);

      // Create document record
      const totalSigners = signers.length + 1; // +1 for company signer
      const {
        data: documentData,
        error: docError
      } = await supabase.from('documents').insert({
        name: title,
        file_url: publicUrl,
        user_id: user.id,
        status: 'pending',
        signers: totalSigners,
        signed_by: 0
      }).select().single();
      if (docError) throw docError;

      // Create company signer record
      const {
        error: companySignerError
      } = await supabase.from('document_signers').insert({
        document_id: documentData.id,
        name: companySigner.name,
        email: companySigner.email,
        phone: companySigner.phone,
        cpf: companySigner.cpf,
        is_company_signer: true,
        status: 'pending'
      });
      if (companySignerError) throw companySignerError;

      // Create external signers records
      const externalSigners = signers.map(signer => ({
        document_id: documentData.id,
        name: signer.name,
        email: signer.email,
        phone: signer.phone,
        cpf: null,
        // Will be filled by signer
        is_company_signer: false,
        status: 'pending'
      }));
      const {
        error: signersError
      } = await supabase.from('document_signers').insert(externalSigners);
      if (signersError) throw signersError;

      // Send email and WhatsApp to each external signer
      for (const signer of signers) {
        try {
          // Send email
          await supabase.functions.invoke('send-signature-email', {
            body: {
              signerName: signer.name,
              signerEmail: signer.email,
              documentName: title,
              documentId: documentData.id,
              senderName: companySigner.name,
              organizationName: companySigner.companyName,
              userId: user.id
            }
          });
          console.log(`Email sent to ${signer.email}`);

          // Send WhatsApp
          await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              signerName: signer.name,
              signerPhone: signer.phone,
              documentName: title,
              documentId: documentData.id,
              organizationName: companySigner.companyName
            }
          });
          console.log(`WhatsApp sent to ${signer.phone}`);
        } catch (error) {
          console.error(`Failed to send notification to ${signer.email}:`, error);
          // Continue even if notification fails - document is already created
        }
      }
      setIsSubmitted(true);
      toast({
        title: "Documento enviado!",
        description: "O documento foi enviado com sucesso e os signatários receberão o convite por e-mail e WhatsApp."
      });
      navigate("/documentos?tab=pending-internal");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar documento",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  return <Layout>
      <div className="p-8 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-sm font-bold text-gray-600">Novo Documento</h1>
          <div className="mt-2 space-y-1">
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${file !== null ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: file === null ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            scale: {
              repeat: file === null ? Infinity : 0,
              duration: 2,
              ease: "easeInOut"
            }
          }}>
              <AnimatePresence mode="wait">
                {file !== null && <motion.div initial={{
                scale: 0,
                rotate: -180
              }} animate={{
                scale: 1,
                rotate: 0
              }} exit={{
                scale: 0,
                rotate: 180
              }} transition={{
                type: "spring",
                stiffness: 200,
                damping: 15
              }}>
                    <Check className="w-3 h-3" />
                  </motion.div>}
              </AnimatePresence>
              <span>Faça upload de 1 ou mais documentos</span>
            </motion.div>
            
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${signers.some(signer => signer.name && signer.phone && signer.email) ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: file !== null && !signers.some(signer => signer.name && signer.phone && signer.email) ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            delay: 0.1,
            scale: {
              repeat: file !== null && !signers.some(signer => signer.name && signer.phone && signer.email) ? Infinity : 0,
              duration: 2,
              ease: "easeInOut"
            }
          }}>
              <AnimatePresence mode="wait">
                {signers.some(signer => signer.name && signer.phone && signer.email) && <motion.div initial={{
                scale: 0,
                rotate: -180
              }} animate={{
                scale: 1,
                rotate: 0
              }} exit={{
                scale: 0,
                rotate: 180
              }} transition={{
                type: "spring",
                stiffness: 200,
                damping: 15
              }}>
                    <Check className="w-3 h-3" />
                  </motion.div>}
              </AnimatePresence>
              <span>Adicione pelo menos 1 signatário</span>
            </motion.div>
            
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${isSubmitted ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: file !== null && signers.some(signer => signer.name && signer.phone && signer.email) && !isSubmitted ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            delay: 0.2,
            scale: {
              repeat: file !== null && signers.some(signer => signer.name && signer.phone && signer.email) && !isSubmitted ? Infinity : 0,
              duration: 2,
              ease: "easeInOut"
            }
          }}>
              <AnimatePresence mode="wait">
                {isSubmitted && <motion.div initial={{
                scale: 0,
                rotate: -180
              }} animate={{
                scale: 1,
                rotate: 0
              }} exit={{
                scale: 0,
                rotate: 180
              }} transition={{
                type: "spring",
                stiffness: 200,
                damping: 15
              }}>
                    <Check className="w-3 h-3" />
                  </motion.div>}
              </AnimatePresence>
              <span>Clique no botão enviar</span>
            </motion.div>
          </div>
        </div>

        <div className="space-y-6 bg-card p-6 rounded-lg border">
          {/* Drag and Drop Area */}
          <div className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            {!file ? <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Arraste e solte seu documento aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">ou</p>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-100 hover:bg-gray-100 hover:text-gray-600">
                  Selecionar Arquivo
                </Button>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                <p className="text-xs text-muted-foreground mt-4">
                  Apenas arquivos PDF são aceitos
                </p>
              </> : <div className="flex items-center justify-center gap-4">
                <FileText className="w-8 h-8 text-primary" />
                <div className="flex-1 text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={removeFile}>
                  <X className="w-4 h-4" />
                </Button>
              </div>}
          </div>

          {/* Form Fields */}
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="title">Título do Documento</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" />
            </div>

            {/* Signers Section */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-gray-600">Signatário Interno</Label>
              
              {/* Company Signer (Read-only) */}
              {companySigner && <div className="p-4 border rounded-lg space-y-3 bg-primary/5">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Signatário da Empresa</p>
                  <div className="grid gap-2">
                    <Label>Nome Completo</Label>
                    <Input value={companySigner.name} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label>CPF</Label>
                    <Input value={companySigner.cpf} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input value={companySigner.phone} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label>E-mail</Label>
                    <Input value={companySigner.email} disabled />
                  </div>
                </div>}

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Signatários Externos</p>
                
              </div>
              {signers.map((signer, index) => <div key={index} className="relative p-4 border rounded-lg space-y-3 bg-orange-50">
                  {signers.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 hover:bg-transparent active:bg-transparent focus:bg-transparent" onClick={() => removeSigner(index)}>
                      <X className="w-4 h-4" />
                    </Button>}
                  
                  <div className="grid gap-2">
                    <Label htmlFor={`name-${index}`}>Nome Completo / Razão Social</Label>
                    <Input id={`name-${index}`} value={signer.name} onChange={e => handleSignerChange(index, "name", e.target.value)} placeholder="Digite o nome ou razão social" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`phone-${index}`}>Telefone</Label>
                    <Input id={`phone-${index}`} value={signer.phone} onChange={e => handleSignerChange(index, "phone", e.target.value)} placeholder="(00)00000-0000" maxLength={14} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`email-${index}`}>E-mail</Label>
                    <Input id={`email-${index}`} type="email" value={signer.email} onChange={e => handleSignerChange(index, "email", e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                </div>)}
              
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={addSigner} className="w-10 h-10 rounded-full hover:bg-transparent active:bg-transparent focus:bg-transparent">
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white border-none hover:opacity-90" onClick={() => navigate("/documentos")}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90" onClick={handleSubmit} disabled={showLimitDialog}>
              Enviar para Assinatura
            </Button>
          </div>
        </div>
      </div>

      {/* Limit Reached Dialog */}
      <AlertDialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limite de Documentos Atingido</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você atingiu o limite de <strong>{limitInfo?.limit} documentos</strong> do plano{" "}
                <strong>{limitInfo?.planName}</strong> este mês.
              </p>
              <p>
                Uso atual: <strong>{limitInfo?.current}/{limitInfo?.limit}</strong>
              </p>
              <p>Faça upgrade do seu plano para continuar criando documentos.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => navigate("/documentos")}>
              Voltar
            </Button>
            <Button onClick={() => navigate("/configuracoes?tab=subscription")} className="bg-gradient-to-r from-[#273d60] to-[#001f3f]">
              Fazer Upgrade
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>;
};
export default NewDocument;