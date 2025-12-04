import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, X, Plus, Check, FolderOpen, BookUser } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SignerAutocomplete, SignerSuggestion } from "@/components/documents/SignerAutocomplete";

type AuthenticationOption = 'IP' | 'SELFIE' | 'GEOLOCATION' | 'OTP_WHATSAPP' | 'OTP_EMAIL' | 'OTP_PHONE';
const AUTHENTICATION_OPTIONS: {
  id: AuthenticationOption;
  label: string;
}[] = [{
  id: 'SELFIE',
  label: 'Biometria Facial'
}, {
  id: 'OTP_WHATSAPP',
  label: 'Código de Verificação WhatsApp'
}, {
  id: 'OTP_EMAIL',
  label: 'Código de Verificação E-mail'
}, {
  id: 'OTP_PHONE',
  label: 'Código de Verificação SMS'
}];

type SignatureMode = 'SIMPLE' | 'ADVANCED' | 'QUALIFIED';
const SIGNATURE_MODES: {
  id: SignatureMode;
  label: string;
  typeName: string;
  description: string;
  badge?: string;
}[] = [
  {
    id: 'SIMPLE',
    label: 'Assinatura Eletrônica',
    typeName: 'Simples',
    description: 'Coleta de evidências (IP + Geolocalização)'
  },
  {
    id: 'ADVANCED',
    label: 'Certificado Digital',
    typeName: 'Avançada',
    description: 'Evidências + Certificado digital em nuvem'
  },
  {
    id: 'QUALIFIED',
    label: 'Certificado ICP-Brasil',
    typeName: 'Qualificada',
    description: 'Evidências + Certificado digital ICP-Brasil',
    badge: 'Maior validade jurídica'
  }
];
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
  const [authOptions, setAuthOptions] = useState<AuthenticationOption[]>(['SELFIE']);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('SIMPLE');
  const [signerSuggestions, setSignerSuggestions] = useState<SignerSuggestion[]>([]);
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
    const hasCompleteSigner = signers.some(signer => signer.name && (signer.phone || signer.email));
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

  // Load contacts for autocomplete
  useEffect(() => {
    const loadContacts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch saved contacts
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('name, email, phone')
        .eq('user_id', user.id)
        .order('name');

      if (contactsData) {
        setSignerSuggestions(contactsData.map(c => ({
          name: c.name,
          email: c.email || '',
          phone: c.phone || ''
        })));
      }
    };
    loadContacts();
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
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ];
      const newFiles = Array.from(e.dataTransfer.files).filter(f => allowedTypes.includes(f.type));
      if (newFiles.length === 0) {
        toast({
          title: "Formato inválido",
          description: "Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, WEBP, GIF.",
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
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ];
      const newFiles = Array.from(e.target.files).filter(f => allowedTypes.includes(f.type));
      if (newFiles.length === 0) {
        toast({
          title: "Formato inválido",
          description: "Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, WEBP, GIF.",
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
  const toggleAuthOption = (option: AuthenticationOption) => {
    setAuthOptions(prev => {
      if (prev.includes(option)) {
        return prev.filter(o => o !== option);
      }
      return [...prev, option];
    });
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
    const hasInvalidSigner = signers.some(signer => !signer.name || !signer.phone && !signer.email);
    if (hasInvalidSigner) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o nome e pelo menos telefone ou e-mail de cada signatário.",
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
        const {
          data: envelopeData,
          error: envelopeError
        } = await supabase.from('envelopes').insert({
          title: title,
          user_id: user.id,
          status: 'pending'
        }).select().single();
        if (envelopeError) throw envelopeError;
        envelopeId = envelopeData.id;
      }
      const documentIds: string[] = [];
      const fileContents: {
        docId: string;
        base64: string;
      }[] = [];

      // Upload and create documents
      for (const file of files) {
        // Upload PDF to storage
        const timestamp = Date.now();
        const sanitizedFileName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.-]/g, '_').replace(/__+/g, '_');
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
        const totalSigners = signers.length + 1;
        const {
          data: documentData,
          error: docError
        } = await supabase.from('documents').insert({
          name: isEnvelope ? `${title} - ${file.name}` : title,
          file_url: publicUrl,
          user_id: user.id,
          status: 'pending',
          signers: totalSigners,
          signed_by: 0,
          envelope_id: envelopeId
        }).select().single();
        if (docError) throw docError;
        documentIds.push(documentData.id);

        // Convert file to base64 for BRy
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        fileContents.push({
          docId: documentData.id,
          base64
        });
      }
      const firstDocumentId = documentIds[0];

      // Create signers for all documents
      for (const docId of documentIds) {
        const {
          error: companySignerError
        } = await supabase.from('document_signers').insert({
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
        const {
          error: signersError
        } = await supabase.from('document_signers').insert(externalSigners);
        if (signersError) throw signersError;
      }

      // Create a SINGLE BRy envelope with ALL documents
      const brySignerLinks: Map<string, string> = new Map(); // key: email or phone

      try {
        const allSigners = [{
          name: companySigner.name,
          email: companySigner.email,
          phone: companySigner.phone
        }, ...signers];

        // Preparar documentos para envio único ao BRy
        const documentsForBry = fileContents.map(fc => ({
          documentId: fc.docId,
          base64: fc.base64,
          fileName: files.find(f => documentIds.indexOf(fc.docId) !== -1)?.name || title,
        }));

        const {
          data: bryData,
          error: bryError
        } = await supabase.functions.invoke('bry-create-envelope', {
          body: {
            documents: documentsForBry,
            title: title,
            signers: allSigners,
            userId: user.id,
            authenticationOptions: ['IP', 'GEOLOCATION', ...authOptions],
            signatureMode: signatureMode
          }
        });

        if (bryError) {
          console.error('BRy envelope creation failed:', bryError);
        } else if (bryData?.signerLinks) {
          for (const link of bryData.signerLinks) {
            const key = link.email || link.phone;
            if (key) {
              brySignerLinks.set(key, link.link);
            }
          }
          console.log('BRy envelope created:', bryData.envelopeUuid, 'with', documentsForBry.length, 'documents');
        }
      } catch (bryErr) {
        console.error('Error creating BRy envelope:', bryErr);
      }

      // Send notifications with BRy links - PARA TODOS incluindo empresa
      const allSignersForNotification = [{
        name: companySigner.name,
        email: companySigner.email,
        phone: companySigner.phone
      }, ...signers];
      for (const signer of allSignersForNotification) {
        try {
          // Get BRy link using email or phone as key
          const bryLink = brySignerLinks.get(signer.email) || brySignerLinks.get(signer.phone);

          // Send email only if email is provided
          if (signer.email) {
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
          }

          // Send WhatsApp only if phone is provided
          if (signer.phone) {
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
          }
        } catch (error) {
          console.error(`Failed to send notification to ${signer.email || signer.phone}:`, error);
        }
      }
      setIsSubmitted(true);
      toast({
        title: isEnvelope ? "Envelope enviado!" : "Documento enviado!",
        description: isEnvelope ? `Envelope com ${files.length} documentos enviado com sucesso. Os signatários receberão o convite por e-mail e WhatsApp.` : "O documento foi enviado com sucesso e os signatários receberão o convite por e-mail e WhatsApp."
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
            
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${signers.some(signer => signer.name && (signer.phone || signer.email)) ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: files.length > 0 && !signers.some(signer => signer.name && (signer.phone || signer.email)) ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            delay: 0.1,
            scale: {
              repeat: files.length > 0 && !signers.some(signer => signer.name && (signer.phone || signer.email)) ? Infinity : 0,
              duration: 2,
              ease: "easeInOut"
            }
          }}>
              <AnimatePresence mode="wait">
                {signers.some(signer => signer.name && (signer.phone || signer.email)) && <motion.div initial={{
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
            scale: files.length > 0 && signers.some(signer => signer.name && (signer.phone || signer.email)) && !isSubmitted ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            delay: 0.2,
            scale: {
              repeat: files.length > 0 && signers.some(signer => signer.name && (signer.phone || signer.email)) && !isSubmitted ? Infinity : 0,
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
          <div className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${dragActive ? "border-primary bg-primary/10 scale-[1.02] shadow-lg" : "border-muted-foreground/25 hover:border-primary/50"}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            {files.length === 0 ? <>
                <Upload className={`w-12 h-12 mx-auto mb-4 transition-all duration-300 ${dragActive ? "text-primary scale-110" : "text-muted-foreground"}`} />
                <p className="font-medium mb-2 text-base text-gray-600">
                  Arraste e solte seu documento
                </p>
                <p className="text-sm text-muted-foreground mb-4">ou</p>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-100 rounded-full shadow-none border-transparent bg-[#273d60] text-primary-foreground hover:bg-[#273d60] hover:text-primary-foreground">
                  Selecionar Arquivo
                </Button>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif" multiple onChange={handleFileChange} className="hidden" />
                <p className="text-xs text-muted-foreground mt-4">
                  PDF, DOC, XLS, PPT e imagens
                </p>
              </> : files.length === 1 ?
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
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif" multiple onChange={handleFileChange} className="hidden" />
                </div> :
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
                  {files.map((file, index) => <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
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
                    </div>)}
                  {files.length < MAX_DOCUMENTS && <div className="flex justify-end mt-3">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent hover:text-gray-500" onClick={() => fileInputRef.current?.click()}>
                        <Plus className="w-4 h-4 text-gray-500" />
                      </Button>
                    </div>}
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif" multiple onChange={handleFileChange} className="hidden" />
                </div>}
          </div>

          {/* Form Fields */}
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="title">Título do Documento</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" className="placeholder:text-xs" />
            </div>

            {/* Signers Section */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-gray-600">Signatário Interno</Label>
              
              {/* Company Signer (Read-only) */}
              {companySigner && <div className="p-4 border rounded-lg space-y-3 bg-primary/5">
                  
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
                  <div className="absolute top-2 right-2 flex gap-1">
                    {signer.name && (signer.phone || signer.email) && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-transparent active:bg-transparent focus:bg-transparent"
                        onClick={async () => {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          
                          // Check if contact already exists
                          const existingContact = signerSuggestions.find(
                            s => s.email === signer.email || s.phone === signer.phone
                          );
                          if (existingContact) {
                            toast({ title: "Contato já existe", description: "Este signatário já está salvo nos seus contatos." });
                            return;
                          }
                          
                          const { error } = await supabase.from('contacts').insert({
                            user_id: user.id,
                            name: signer.name,
                            email: signer.email || null,
                            phone: signer.phone || null
                          });
                          
                          if (error) {
                            toast({ title: "Erro", description: "Não foi possível salvar o contato.", variant: "destructive" });
                          } else {
                            toast({ title: "Contato salvo!", description: "Signatário adicionado aos seus contatos." });
                            // Refresh suggestions
                            setSignerSuggestions(prev => [...prev, { name: signer.name, email: signer.email, phone: signer.phone }]);
                          }
                        }}
                        title="Salvar como contato"
                      >
                        <BookUser className="w-4 h-4 text-gray-500" />
                      </Button>
                    )}
                    {signers.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent active:bg-transparent focus:bg-transparent" onClick={() => removeSigner(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor={`name-${index}`}>Nome Completo / Razão Social</Label>
                    <SignerAutocomplete
                      value={signer.name}
                      onChange={(value) => handleSignerChange(index, "name", value)}
                      onSelectSigner={(suggestion) => {
                        const newSigners = [...signers];
                        newSigners[index] = {
                          name: suggestion.name,
                          phone: suggestion.phone || "",
                          email: suggestion.email || ""
                        };
                        setSigners(newSigners);
                      }}
                      suggestions={signerSuggestions}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`phone-${index}`}>Telefone</Label>
                    <Input id={`phone-${index}`} value={signer.phone} onChange={e => handleSignerChange(index, "phone", e.target.value)} placeholder="(00)00000-0000" maxLength={14} inputMode="tel" className="placeholder:text-xs" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`email-${index}`}>E-mail</Label>
                    <Input id={`email-${index}`} type="email" value={signer.email} onChange={e => handleSignerChange(index, "email", e.target.value)} placeholder="email@exemplo.com" className="placeholder:text-xs" />
                  </div>
                </div>)}
              
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={addSigner} className="w-10 h-10 rounded-full hover:bg-transparent active:bg-transparent focus:bg-transparent">
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Signature Mode Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-600">Tipo de Assinatura</Label>
            <RadioGroup value={signatureMode} onValueChange={(value) => setSignatureMode(value as SignatureMode)} className="space-y-2">
              {SIGNATURE_MODES.map(mode => (
                <div
                  key={mode.id}
                  onClick={() => setSignatureMode(mode.id)}
                  className={`px-3 py-3 rounded cursor-pointer transition-colors ${
                    signatureMode === mode.id 
                      ? 'bg-primary/10 border border-primary/30' 
                      : 'bg-sidebar-foreground hover:bg-sidebar-foreground/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={mode.id} id={mode.id} />
                    <span className="text-sm font-semibold text-gray-800">{mode.typeName}</span>
                  </div>
                  <div className="ml-6 mt-1">
                    <span className="text-sm font-medium text-gray-700">{mode.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{mode.description}</p>
                    {mode.badge && (
                      <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium mt-1.5">
                        {mode.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Authentication Options Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-600">Níveis de Verificação</Label>
            <div className="space-y-2">
              {AUTHENTICATION_OPTIONS.map(option => {
              const isSelected = authOptions.includes(option.id);
              return <div key={option.id} onClick={() => toggleAuthOption(option.id)} className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer bg-sidebar-foreground">
                    <Checkbox checked={isSelected} onClick={e => e.stopPropagation()} onCheckedChange={() => toggleAuthOption(option.id)} />
                    <span className="text-sm text-gray-600">{option.label}</span>
                  </div>;
            })}
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