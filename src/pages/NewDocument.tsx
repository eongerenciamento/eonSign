import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Plus, Check, FolderOpen } from "lucide-react";
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
  const MAX_DOCUMENTS = 10;
  const MAX_SIGNERS_ENVELOPE = 20;
  const MAX_SIGNERS_DOCUMENT = 99;
  
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
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
  
  const isEnvelope = files.length >= 2;
  const maxSigners = isEnvelope ? MAX_SIGNERS_ENVELOPE : MAX_SIGNERS_DOCUMENT;

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
    if (files.length > 0) {
      playCompletionSound(800); // Mid-high frequency
    }
  }, [files]);

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
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
      
      if (newFiles.length === 0) {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos PDF.",
          variant: "destructive"
        });
        return;
      }
      
      if (files.length + newFiles.length > MAX_DOCUMENTS) {
        toast({
          title: "Limite excedido",
          description: `Você pode enviar no máximo ${MAX_DOCUMENTS} documentos.`,
          variant: "destructive"
        });
        return;
      }
      
      setFiles([...files, ...newFiles]);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(f => f.type === "application/pdf");
      
      if (newFiles.length === 0) {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos PDF.",
          variant: "destructive"
        });
        return;
      }
      
      if (files.length + newFiles.length > MAX_DOCUMENTS) {
        toast({
          title: "Limite excedido",
          description: `Você pode enviar no máximo ${MAX_DOCUMENTS} documentos.`,
          variant: "destructive"
        });
        return;
      }
      
      setFiles([...files, ...newFiles]);
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
  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async () => {
    if (files.length === 0 || !title) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o título e selecione pelo menos um arquivo.",
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
    
    // Validate signers limit based on mode
    if (signers.length > maxSigners) {
      toast({
        title: "Limite de signatários",
        description: `${isEnvelope ? 'Envelopes' : 'Documentos'} permitem no máximo ${maxSigners} signatários externos.`,
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

      let envelopeId: string | null = null;
      
      // If envelope mode (2+ documents), create envelope first
      if (isEnvelope) {
        const { data: envelopeData, error: envelopeError } = await supabase
          .from('envelopes')
          .insert({
            title: title,
            user_id: user.id,
            status: 'pending'
          })
          .select()
          .single();
          
        if (envelopeError) throw envelopeError;
        envelopeId = envelopeData.id;
      }

      const documentIds: string[] = [];
      const fileContents: { docId: string; base64: string }[] = [];
      
      // Upload and create documents
      for (const file of files) {
        // Upload PDF to storage
        const timestamp = Date.now();
        const sanitizedFileName = file.name.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .replace(/__+/g, '_');
        const filePath = `${user.id}/${timestamp}-${sanitizedFileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        // Create document record
        const totalSigners = signers.length + 1;
        const { data: documentData, error: docError } = await supabase
          .from('documents')
          .insert({
            name: isEnvelope ? `${title} - ${file.name}` : title,
            file_url: publicUrl,
            user_id: user.id,
            status: 'pending',
            signers: totalSigners,
            signed_by: 0,
            envelope_id: envelopeId
          })
          .select()
          .single();
        if (docError) throw docError;
        
        documentIds.push(documentData.id);

        // Convert file to base64 for BRy
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        fileContents.push({ docId: documentData.id, base64 });
      }
      
      const firstDocumentId = documentIds[0];

      // Create signers for all documents
      for (const docId of documentIds) {
        const { error: companySignerError } = await supabase
          .from('document_signers')
          .insert({
            document_id: docId,
            name: companySigner.name,
            email: companySigner.email,
            phone: companySigner.phone,
            cpf: companySigner.cpf,
            is_company_signer: true,
            status: 'pending'
          });
        if (companySignerError) throw companySignerError;

        const externalSigners = signers.map(signer => ({
          document_id: docId,
          name: signer.name,
          email: signer.email,
          phone: signer.phone,
          cpf: null,
          is_company_signer: false,
          status: 'pending'
        }));
        
        const { error: signersError } = await supabase
          .from('document_signers')
          .insert(externalSigners);
        if (signersError) throw signersError;
      }

      // Create BRy envelope for each document
      const brySignerLinks: Map<string, string> = new Map();
      
      for (const fileContent of fileContents) {
        try {
          const allSigners = [
            { name: companySigner.name, email: companySigner.email, phone: companySigner.phone },
            ...signers
          ];
          
          const { data: bryData, error: bryError } = await supabase.functions.invoke('bry-create-envelope', {
            body: {
              documentId: fileContent.docId,
              title: title,
              signers: allSigners,
              documentBase64: fileContent.base64,
              userId: user.id
            }
          });
          
          if (bryError) {
            console.error('BRy envelope creation failed:', bryError);
          } else if (bryData?.signerLinks) {
            for (const link of bryData.signerLinks) {
              brySignerLinks.set(link.email, link.link);
            }
            console.log('BRy envelope created:', bryData.envelopeUuid);
          }
        } catch (bryErr) {
          console.error('Error creating BRy envelope:', bryErr);
        }
      }

      // Send notifications with BRy links - PARA TODOS incluindo empresa
      const allSignersForNotification = [
        { name: companySigner.name, email: companySigner.email, phone: companySigner.phone },
        ...signers
      ];

      for (const signer of allSignersForNotification) {
        try {
          const bryLink = brySignerLinks.get(signer.email);
          
          await supabase.functions.invoke('send-signature-email', {
            body: {
              signerName: signer.name,
              signerEmail: signer.email,
              documentName: title,
              documentId: firstDocumentId,
              senderName: companySigner.name,
              organizationName: companySigner.companyName,
              userId: user.id,
              brySignerLink: bryLink
            }
          });

          await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              signerName: signer.name,
              signerPhone: signer.phone,
              documentName: title,
              documentId: firstDocumentId,
              organizationName: companySigner.companyName,
              brySignerLink: bryLink
            }
          });
        } catch (error) {
          console.error(`Failed to send notification to ${signer.email}:`, error);
        }
      }
      
      setIsSubmitted(true);
      toast({
        title: isEnvelope ? "Envelope enviado!" : "Documento enviado!",
        description: isEnvelope 
          ? `Envelope com ${files.length} documentos enviado com sucesso. Os signatários receberão o convite por e-mail e WhatsApp.`
          : "O documento foi enviado com sucesso e os signatários receberão o convite por e-mail e WhatsApp."
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
  return <Layout>
      <div className="p-8 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-sm font-bold text-gray-600">Novo Documento</h1>
          <div className="mt-2 space-y-1">
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${files.length > 0 ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: files.length === 0 ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            scale: {
              repeat: files.length === 0 ? Infinity : 0,
              duration: 2,
              ease: "easeInOut"
            }
          }}>
              <AnimatePresence mode="wait">
                {files.length > 0 && <motion.div initial={{
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
              <span>Faça upload de 1 ou mais documentos (máx. {MAX_DOCUMENTS})</span>
            </motion.div>
            
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${signers.some(signer => signer.name && signer.phone && signer.email) ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: files.length > 0 && !signers.some(signer => signer.name && signer.phone && signer.email) ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            delay: 0.1,
            scale: {
              repeat: files.length > 0 && !signers.some(signer => signer.name && signer.phone && signer.email) ? Infinity : 0,
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
              <span>Adicione pelo menos 1 signatário{isEnvelope ? ' (máx. 20 para envelope)' : ''}</span>
            </motion.div>
            
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${isSubmitted ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: files.length > 0 && signers.some(signer => signer.name && signer.phone && signer.email) && !isSubmitted ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            delay: 0.2,
            scale: {
              repeat: files.length > 0 && signers.some(signer => signer.name && signer.phone && signer.email) && !isSubmitted ? Infinity : 0,
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
          <div className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            {files.length === 0 ? <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium mb-2 text-base text-gray-600">
                  Arraste e solte seu documento aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">ou</p>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-100 rounded-full shadow-none border-transparent bg-[#273d60] text-primary-foreground hover:bg-[#273d60] hover:text-primary-foreground">
                  Selecionar Arquivo
                </Button>
                <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileChange} className="hidden" />
                <p className="text-xs text-muted-foreground mt-4">
                  Apenas arquivos PDF são aceitos
                </p>
              </> : files.length === 1 ? (
                // Single document - simple view
                <div className="flex items-center justify-center gap-4">
                  <FileText className="w-8 h-8 text-gray-500" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm text-gray-600">{files[0].name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(files[0].size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(0)} className="h-8 w-8 hover:bg-transparent hover:text-gray-500">
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-8 w-8 hover:bg-transparent hover:text-gray-500">
                    <Plus className="w-4 h-4 text-gray-500" />
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileChange} className="hidden" />
                </div>
              ) : (
                // Multiple documents - envelope view
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-gray-500" />
                      <p className="text-xs font-medium text-gray-600">
                        Envelope ({files.length}/{MAX_DOCUMENTS} docs)
                      </p>
                    </div>
                    <p className="text-xs text-blue-600 font-medium">
                      1 crédito
                    </p>
                  </div>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-sm md:text-base text-gray-600 truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 hover:bg-transparent hover:text-gray-500" onClick={() => removeFile(index)}>
                        <X className="w-4 h-4 text-gray-500" />
                      </Button>
                    </div>
                  ))}
                  {files.length < MAX_DOCUMENTS && (
                    <div className="flex justify-end mt-3">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent hover:text-gray-500" onClick={() => fileInputRef.current?.click()}>
                        <Plus className="w-4 h-4 text-gray-500" />
                      </Button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileChange} className="hidden" />
                </div>
              )}
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
                <p className="text-sm font-semibold text-gray-600">Signatários Externos</p>
                
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
                    <Input id={`phone-${index}`} value={signer.phone} onChange={e => handleSignerChange(index, "phone", e.target.value)} placeholder="(00)00000-0000" maxLength={14} inputMode="tel" />
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