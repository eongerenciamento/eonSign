import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, X, Plus, Check, FolderOpen, BookUser, FileEdit, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SignerAutocomplete, SignerSuggestion, SignerGroup } from "@/components/documents/SignerAutocomplete";
import { PatientAutocomplete, PatientSuggestion } from "@/components/documents/PatientAutocomplete";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrySigningDialog } from "@/components/documents/BrySigningDialog";
import jsPDF from "jspdf";

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

type SignatureMode = 'SIMPLE' | 'ADVANCED' | 'QUALIFIED' | 'PRESCRIPTION';
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
    description: 'Cada signatário posiciona sua assinatura no documento (IP + Geolocalização)'
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
  },
  {
    id: 'PRESCRIPTION',
    label: 'Área da saúde',
    typeName: 'Prescrição',
    description: 'Lei n. 14.063/20 - Res. n. 2.299/21 (CFM)'
  }
];

// Prescription document types for healthcare professionals
type PrescriptionDocType = 'MEDICAMENTO' | 'ATESTADO' | 'SOLICITACAO_EXAME' | 'LAUDO' | 'SUMARIA_ALTA' | 'ATENDIMENTO_CLINICO' | 'DISPENSACAO_MEDICAMENTO' | 'VACINACAO' | 'RELATORIO_MEDICO';
const PRESCRIPTION_DOC_TYPES: { id: PrescriptionDocType; label: string }[] = [
  { id: 'MEDICAMENTO', label: 'Prescrição de medicamento' },
  { id: 'ATESTADO', label: 'Atestado médico' },
  { id: 'SOLICITACAO_EXAME', label: 'Solicitação de exame' },
  { id: 'LAUDO', label: 'Laudo laboratorial' },
  { id: 'SUMARIA_ALTA', label: 'Sumária de alta' },
  { id: 'ATENDIMENTO_CLINICO', label: 'Registro de atendimento clínico' },
  { id: 'DISPENSACAO_MEDICAMENTO', label: 'Dispensação de medicamento' },
  { id: 'VACINACAO', label: 'Indicação para vacinação' },
  { id: 'RELATORIO_MEDICO', label: 'Relatório médico' },
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

interface HealthcareInfo {
  professionalCouncil: string;
  professionalRegistration: string;
  registrationState: string;
  medicalSpecialty: string | null;
  healthcareCep: string;
  healthcareStreet: string;
  healthcareNeighborhood: string;
  healthcareCity: string;
  healthcareState: string;
}

interface PatientInfo {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email: string;
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
  const [signerGroups, setSignerGroups] = useState<SignerGroup[]>([]);
  const [isHealthcareProfessional, setIsHealthcareProfessional] = useState(false);
  const [healthcareInfo, setHealthcareInfo] = useState<HealthcareInfo | null>(null);
  const [showPrescriptionSheet, setShowPrescriptionSheet] = useState(false);
  const [prescriptionContent, setPrescriptionContent] = useState("");
  const [prescriptionDocType, setPrescriptionDocType] = useState<PrescriptionDocType>('MEDICAMENTO');
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({ name: '', cpf: '', birthDate: '', phone: '', email: '' });
  const [patientSuggestions, setPatientSuggestions] = useState<PatientSuggestion[]>([]);
  const [isPrescriptionSubmitting, setIsPrescriptionSubmitting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBryDialog, setShowBryDialog] = useState(false);
  const [prescriptionBryUrl, setPrescriptionBryUrl] = useState<string | null>(null);
  const [prescriptionDocumentId, setPrescriptionDocumentId] = useState<string | null>(null);
  const [prescriptionDocumentName, setPrescriptionDocumentName] = useState<string>("");
  const [hasLocalCertificate, setHasLocalCertificate] = useState(false);
  const [requireFacialBiometry, setRequireFacialBiometry] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const isEnvelope = files.length >= 2;
  const maxSigners = isEnvelope ? MAX_SIGNERS_ENVELOPE : MAX_SIGNERS_DOCUMENT;
  const isPrescriptionMode = signatureMode === 'PRESCRIPTION';

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
        } = await supabase.from('company_settings').select('admin_name, admin_cpf, admin_phone, admin_email, company_name, is_healthcare, professional_council, professional_registration, registration_state, medical_specialty, healthcare_cep, healthcare_street, healthcare_neighborhood, healthcare_city, healthcare_state, certificate_file_url, certificate_password_encrypted, certificate_valid_to').eq('user_id', user.id).single();
        if (companyData) {
          setCompanySigner({
            name: companyData.admin_name,
            cpf: companyData.admin_cpf,
            phone: companyData.admin_phone,
            email: companyData.admin_email,
            companyName: companyData.company_name
          });
          setIsHealthcareProfessional((companyData as any).is_healthcare || false);
          if ((companyData as any).is_healthcare) {
            setHealthcareInfo({
              professionalCouncil: (companyData as any).professional_council || 'CRM',
              professionalRegistration: (companyData as any).professional_registration || '',
              registrationState: (companyData as any).registration_state || '',
              medicalSpecialty: (companyData as any).medical_specialty || null,
              healthcareCep: (companyData as any).healthcare_cep || '',
              healthcareStreet: (companyData as any).healthcare_street || '',
              healthcareNeighborhood: (companyData as any).healthcare_neighborhood || '',
              healthcareCity: (companyData as any).healthcare_city || '',
              healthcareState: (companyData as any).healthcare_state || ''
            });
          }
          // Check if user has a valid local certificate for QUALIFIED signatures
          const certUrl = (companyData as any).certificate_file_url;
          const certPassword = (companyData as any).certificate_password_encrypted;
          const certValidTo = (companyData as any).certificate_valid_to;
          if (certUrl && certPassword) {
            // Check if certificate is not expired
            const validTo = certValidTo ? new Date(certValidTo) : null;
            const isValid = validTo ? validTo > new Date() : false;
            setHasLocalCertificate(isValid);
            console.log('[NewDocument] Local certificate found, valid:', isValid);
          }
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

  // Load groups for autocomplete
  useEffect(() => {
    const loadGroups = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: groupsData } = await supabase
        .from('signer_groups')
        .select(`
          id,
          name,
          signer_group_members (
            contact_id,
            contacts (id, name, email, phone)
          )
        `)
        .eq('user_id', user.id)
        .order('name');

      if (groupsData) {
        const formattedGroups: SignerGroup[] = groupsData.map(g => ({
          id: g.id,
          name: g.name,
          members: g.signer_group_members
            ?.map((m: any) => ({
              name: m.contacts?.name || '',
              email: m.contacts?.email || '',
              phone: m.contacts?.phone || ''
            }))
            .filter((m: any) => m.name) || []
        }));
        setSignerGroups(formattedGroups);
      }
    };
    loadGroups();
  }, []);

  // Load patients for autocomplete (healthcare professionals only)
  useEffect(() => {
    const loadPatients = async () => {
      if (!isHealthcareProfessional) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, cpf, birth_date, phone, email')
        .eq('user_id', user.id)
        .order('name');

      if (patientsData) {
        setPatientSuggestions(patientsData.map(p => ({
          id: p.id,
          name: p.name,
          cpf: p.cpf || '',
          birthDate: p.birth_date || '',
          phone: p.phone || '',
          email: p.email || ''
        })));
      }
    };
    loadPatients();
  }, [isHealthcareProfessional]);

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

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const validateCpf = (cpf: string): boolean => {
    const numbers = cpf.replace(/\D/g, "");
    
    if (numbers.length !== 11) return false;
    
    // Check for all same digits
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    // Validate first check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[9])) return false;
    
    // Validate second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[10])) return false;
    
    return true;
  };

  const formatBirthDate = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
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

  // Generate PDF from prescription content
  const generatePrescriptionPdf = async (): Promise<File> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const footerHeight = 50;
    
    // Gray color for text (gray-600 equivalent: rgb(75, 85, 99))
    const gray600 = { r: 75, g: 85, b: 99 };
    
    // Header with professional info on LEFT and address on RIGHT
    doc.setTextColor(gray600.r, gray600.g, gray600.b);
    let yPos = 20;
    
    // LEFT SIDE - Professional info (smaller size)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(companySigner?.name || '', margin, yPos);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos += 6;
    
    if (healthcareInfo) {
      const councilText = `${healthcareInfo.professionalCouncil} ${healthcareInfo.professionalRegistration}/${healthcareInfo.registrationState}`;
      doc.text(councilText, margin, yPos);
      yPos += 5;
      
      if (healthcareInfo.medicalSpecialty) {
        doc.text(healthcareInfo.medicalSpecialty, margin, yPos);
        yPos += 5;
      }
    }
    
    // RIGHT SIDE - Address
    const rightX = pageWidth - margin;
    let addressY = 20;
    
    if (healthcareInfo) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      if (healthcareInfo.healthcareStreet) {
        doc.text(healthcareInfo.healthcareStreet, rightX, addressY, { align: 'right' });
        addressY += 4;
      }
      // Neighborhood, City and State on same line
      const neighborhoodCityState = [
        healthcareInfo.healthcareNeighborhood,
        healthcareInfo.healthcareCity,
        healthcareInfo.healthcareState
      ].filter(Boolean).join(', ');
      if (neighborhoodCityState) {
        doc.text(neighborhoodCityState, rightX, addressY, { align: 'right' });
        addressY += 4;
      }
      // CEP below
      if (healthcareInfo.healthcareCep) {
        doc.text(`CEP: ${healthcareInfo.healthcareCep}`, rightX, addressY, { align: 'right' });
        addressY += 4;
      }
    }
    
    // Use the max of left and right content height
    yPos = Math.max(yPos, addressY) + 5;
    
    // Line separator
    doc.setDrawColor(gray600.r, gray600.g, gray600.b);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 15;

    // Patient info section
    if (patientInfo.name) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('PACIENTE:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(patientInfo.name, margin + 25, yPos);
      yPos += 6;
      
      if (patientInfo.cpf) {
        doc.setFont('helvetica', 'bold');
        doc.text('CPF:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(patientInfo.cpf, margin + 12, yPos);
        
        if (patientInfo.birthDate) {
          doc.setFont('helvetica', 'bold');
          doc.text('Data Nasc.:', margin + 55, yPos);
          doc.setFont('helvetica', 'normal');
          doc.text(patientInfo.birthDate, margin + 82, yPos);
        }
        yPos += 6;
      } else if (patientInfo.birthDate) {
        doc.setFont('helvetica', 'bold');
        doc.text('Data Nasc.:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(patientInfo.birthDate, margin + 27, yPos);
        yPos += 6;
      }
      
      // Another separator after patient info
      yPos += 5;
      doc.setDrawColor(gray600.r, gray600.g, gray600.b);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;
    }
    
    // CENTRALIZED TITLE - "PRESCRIÇÃO" + type
    const prescriptionTypeLabel = PRESCRIPTION_DOC_TYPES.find(t => t.id === prescriptionDocType)?.label || prescriptionDocType;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESCRIÇÃO', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(prescriptionTypeLabel, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Prescription content
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(prescriptionContent, contentWidth);
    doc.text(lines, margin, yPos);
    
    // Footer with gray background and metadata
    const footerY = pageHeight - footerHeight;
    
    // Gray background for footer
    doc.setFillColor(240, 240, 240);
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');
    
    // Footer content - 3 columns: LEFT: professional data, CENTER: metadata, RIGHT: logo
    doc.setFontSize(7);
    doc.setTextColor(gray600.r, gray600.g, gray600.b);
    doc.setFont('helvetica', 'normal');
    
    const footerMargin = 10;
    const columnWidth = (pageWidth - footerMargin * 2) / 3;
    const leftColumnX = footerMargin;
    const centerColumnX = footerMargin + columnWidth;
    const rightColumnX = footerMargin + columnWidth * 2;
    
    // LEFT COLUMN - Professional data (left-justified)
    let leftY = footerY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO PROFISSIONAL', leftColumnX, leftY);
    doc.setFont('helvetica', 'normal');
    leftY += 4;
    
    doc.text(`Nome: ${companySigner?.name || '-'}`, leftColumnX, leftY);
    leftY += 3.5;
    
    if (healthcareInfo) {
      doc.text(`${healthcareInfo.professionalCouncil} ${healthcareInfo.professionalRegistration}/${healthcareInfo.registrationState}`, leftColumnX, leftY);
      leftY += 3.5;
      if (healthcareInfo.medicalSpecialty) {
        doc.text(`Especialidade: ${healthcareInfo.medicalSpecialty}`, leftColumnX, leftY);
        leftY += 3.5;
      }
    }
    
    // Prescription type (using already defined prescriptionTypeLabel from title section)
    doc.text(`Tipo: ${prescriptionTypeLabel}`, leftColumnX, leftY);
    leftY += 3.5;
    
    // Date/time
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Emitido em: ${dateStr} às ${timeStr}`, leftColumnX, leftY);
    
    // CENTER COLUMN - Certificate metadata (left-justified within column)
    let centerY = footerY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('METADADOS DO CERTIFICADO', centerColumnX, centerY);
    doc.setFont('helvetica', 'normal');
    centerY += 4;
    doc.text('Assinatura: Certificado Digital', centerColumnX, centerY);
    centerY += 3.5;
    doc.text('ICP-Brasil (QUALIFIED)', centerColumnX, centerY);
    centerY += 3.5;
    doc.text('Lei n. 14.063/2020', centerColumnX, centerY);
    centerY += 3.5;
    doc.text('Res. n. 2.299/2021 (CFM)', centerColumnX, centerY);
    
    // RIGHT COLUMN - Logo (centered with other columns, positioned higher)
    try {
      const logoUrl = '/logo-eon-sign.png';
      const response = await fetch(logoUrl);
      if (response.ok) {
        const logoBlob = await response.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        
        // Add logo to the right column, aligned with headers of other columns
        const logoWidth = 30;
        const logoHeight = 18;
        const logoX = rightColumnX + (columnWidth - logoWidth) / 2; // Center in column
        const logoY = footerY + 6; // Align with column headers
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
      }
    } catch (logoError) {
      console.log('Could not load logo for PDF footer:', logoError);
    }
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Convert to File
    const pdfBlob = doc.output('blob');
    const fileName = title || 'Prescricao';
    return new File([pdfBlob], `${fileName}.pdf`, { type: 'application/pdf' });
  };
  // Function to convert image files to PDF for BRy compatibility
  const convertImageToPdf = async (imageFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const img = new Image();
          img.onload = () => {
            // Determine orientation based on image dimensions
            const isLandscape = img.width > img.height;
            const pdf = new jsPDF({
              orientation: isLandscape ? 'landscape' : 'portrait',
              unit: 'mm',
            });
            
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // Calculate dimensions to fit in page with margins
            const margin = 10; // 10mm margin
            const maxWidth = pageWidth - (margin * 2);
            const maxHeight = pageHeight - (margin * 2);
            
            const imgRatio = img.width / img.height;
            const pageRatio = maxWidth / maxHeight;
            
            let imgWidth, imgHeight;
            if (imgRatio > pageRatio) {
              imgWidth = maxWidth;
              imgHeight = imgWidth / imgRatio;
            } else {
              imgHeight = maxHeight;
              imgWidth = imgHeight * imgRatio;
            }
            
            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;
            
            pdf.addImage(e.target?.result as string, 'JPEG', x, y, imgWidth, imgHeight);
            
            const pdfBlob = pdf.output('blob');
            const pdfFileName = imageFile.name.replace(/\.[^/.]+$/, '') + '.pdf';
            const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
            
            console.log(`[Upload] Converted image ${imageFile.name} to PDF: ${pdfFileName}`);
            resolve(pdfFile);
          };
          img.onerror = () => reject(new Error('Falha ao carregar imagem'));
          img.src = e.target?.result as string;
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(imageFile);
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Determine the effective title
    const effectiveTitle = title || (files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, '') : 'Prescrição');
    
    // Check for prescription mode with content typed
    const hasPrescriptionContent = isPrescriptionMode && prescriptionContent.trim();
    
    // Validate based on mode
    if (!hasPrescriptionContent && files.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione pelo menos um arquivo ou preencha a prescrição.",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    // Validate patient CPF for prescription mode
    if (isPrescriptionMode && patientInfo.cpf) {
      if (!validateCpf(patientInfo.cpf)) {
        toast({
          title: "CPF inválido",
          description: "O CPF do paciente informado é inválido.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
    }

    // For non-prescription modes, validate signers
    if (!isPrescriptionMode) {
      const hasInvalidSigner = signers.some(signer => !signer.name || !signer.phone && !signer.email);
      if (hasInvalidSigner) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha o nome e pelo menos telefone ou e-mail de cada signatário.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      // Validate signers limit based on mode
      if (signers.length > maxSigners) {
        toast({
          title: "Limite de signatários",
          description: `${isEnvelope ? 'Envelopes' : 'Documentos'} permitem no máximo ${maxSigners} signatários externos.`,
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (!companySigner) {
      toast({
        title: "Erro",
        description: "Configure os dados da empresa antes de enviar documentos.",
        variant: "destructive"
      });
      setIsSubmitting(false);
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

      // Prepare files - generate PDF from prescription if needed
      let filesToUpload = [...files];
      if (hasPrescriptionContent && files.length === 0) {
        setIsPrescriptionSubmitting(true);
        
        // Generate the base prescription PDF
        const prescriptionPdf = await generatePrescriptionPdf();
        
        // Use the generated prescription PDF directly
        // OID metadata will be applied by BRy during digital signature with certificate
        filesToUpload = [prescriptionPdf];
        
        setIsPrescriptionSubmitting(false);

        // Save patient to database for autocomplete on future prescriptions
        if (patientInfo.name) {
          // Check if patient already exists
          const existingPatient = patientSuggestions.find(
            p => p.name.toLowerCase() === patientInfo.name.toLowerCase() || 
                 (patientInfo.cpf && p.cpf === patientInfo.cpf)
          );

          if (existingPatient) {
            // Update existing patient with new contact information
            const updateData: Record<string, string | null> = {};
            if (patientInfo.phone && patientInfo.phone !== existingPatient.phone) {
              updateData.phone = patientInfo.phone;
            }
            if (patientInfo.email && patientInfo.email !== existingPatient.email) {
              updateData.email = patientInfo.email;
            }
            if (patientInfo.cpf && patientInfo.cpf !== existingPatient.cpf) {
              updateData.cpf = patientInfo.cpf;
            }
            if (patientInfo.birthDate && patientInfo.birthDate !== existingPatient.birthDate) {
              updateData.birth_date = patientInfo.birthDate;
            }

            if (Object.keys(updateData).length > 0) {
              await supabase
                .from('patients')
                .update(updateData)
                .eq('id', existingPatient.id);

              // Update local suggestions
              setPatientSuggestions(prev => prev.map(p => 
                p.id === existingPatient.id 
                  ? { ...p, ...patientInfo, birthDate: patientInfo.birthDate }
                  : p
              ));
            }
          } else {
            const { data: newPatient, error: patientError } = await supabase
              .from('patients')
              .insert({
                user_id: user.id,
                name: patientInfo.name,
                cpf: patientInfo.cpf || null,
                birth_date: patientInfo.birthDate || null,
                phone: patientInfo.phone || null,
                email: patientInfo.email || null
              })
              .select('id')
              .single();

            if (!patientError && newPatient) {
              // Add to local suggestions for immediate use
              setPatientSuggestions(prev => [...prev, {
                id: newPatient.id,
                name: patientInfo.name,
                cpf: patientInfo.cpf,
                birthDate: patientInfo.birthDate,
                phone: patientInfo.phone,
                email: patientInfo.email
              }]);
            }
          }
        }
      }

      // For non-prescription modes, save signers to contacts
      if (!isPrescriptionMode) {
        const savedContactIds: string[] = [];
        for (const signer of signers) {
          if (!signer.name || (!signer.email && !signer.phone)) continue;
          
          // Verificar se já existe por email ou telefone
          let query = supabase
            .from('contacts')
            .select('id')
            .eq('user_id', user.id);
          
          if (signer.email && signer.phone) {
            query = query.or(`email.eq.${signer.email},phone.eq.${signer.phone}`);
          } else if (signer.email) {
            query = query.eq('email', signer.email);
          } else if (signer.phone) {
            query = query.eq('phone', signer.phone);
          }
          
          const { data: existingContact } = await query.maybeSingle();

          if (existingContact) {
            savedContactIds.push(existingContact.id);
          } else {
            // Criar novo contato
            const { data: newContact } = await supabase.from('contacts').insert({
              user_id: user.id,
              name: signer.name,
              email: signer.email || null,
              phone: signer.phone || null
            }).select('id').single();
            
            if (newContact) {
              savedContactIds.push(newContact.id);
            }
          }
        }

        // Criar grupo automaticamente se houver mais de 1 signatário
        if (signers.length > 1 && savedContactIds.length > 1) {
          const { data: newGroup } = await supabase
            .from('signer_groups')
            .insert({
              user_id: user.id,
              name: 'Novo grupo'
            })
            .select('id')
            .single();

          if (newGroup) {
            // Adicionar membros ao grupo
            const groupMembers = savedContactIds.map(contactId => ({
              group_id: newGroup.id,
              contact_id: contactId
            }));
            
            await supabase.from('signer_group_members').insert(groupMembers);
          }
        }
      }

      // Convert image files to PDF for BRy compatibility (ADVANCED/QUALIFIED modes)
      const requiresPdfConversion = signatureMode !== 'SIMPLE';
      if (requiresPdfConversion) {
        const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
        const convertedFiles: File[] = [];

        for (const file of filesToUpload) {
          if (IMAGE_TYPES.includes(file.type)) {
            console.log(`[Upload] Converting image ${file.name} to PDF for BRy compatibility`);
            try {
              const pdfFile = await convertImageToPdf(file);
              convertedFiles.push(pdfFile);
            } catch (conversionError) {
              console.error(`[Upload] Failed to convert image ${file.name}:`, conversionError);
              toast({
                title: "Erro na conversão",
                description: `Não foi possível converter a imagem ${file.name} para PDF.`,
                variant: "destructive"
              });
              setIsSubmitting(false);
              return;
            }
          } else {
            convertedFiles.push(file);
          }
        }

        filesToUpload = convertedFiles;
      }

      let envelopeId: string | null = null;

      // If envelope mode (2+ documents), create envelope first
      if (filesToUpload.length >= 2) {
        const {
          data: envelopeData,
          error: envelopeError
        } = await supabase.from('envelopes').insert({
          title: effectiveTitle,
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
      for (const file of filesToUpload) {
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
        // For prescription mode, only company signer (1 signer total)
        // Prescription uses QUALIFIED mode for ICP-Brasil compliance
        const totalSigners = isPrescriptionMode ? 1 : signers.length + 1;
        const dbSignatureMode = isPrescriptionMode ? 'QUALIFIED' : signatureMode;
        const {
          data: documentData,
          error: docError
        } = await supabase.from('documents').insert({
          name: filesToUpload.length >= 2 ? `${effectiveTitle} - ${file.name}` : effectiveTitle,
          file_url: publicUrl,
          user_id: user.id,
          status: 'pending',
          signers: totalSigners,
          signed_by: 0,
          envelope_id: envelopeId,
          signature_mode: dbSignatureMode,
          patient_name: isPrescriptionMode && patientInfo.name ? patientInfo.name : null,
          prescription_doc_type: isPrescriptionMode ? prescriptionDocType : null,
          require_facial_biometry: signatureMode === 'SIMPLE' ? requireFacialBiometry : false
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
        // Always add company signer
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

        // For non-prescription modes, add external signers
        if (!isPrescriptionMode) {
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
      }

      // For SIMPLE signatures, use native flow without BRy
      // For ADVANCED, use BRy integration with cloud certificate
      // For QUALIFIED with local certificate, use sign-with-local-certificate
      // For QUALIFIED without local certificate or PRESCRIPTION, use BRy with ICP-Brasil
      const brySignerLinks: Map<string, string> = new Map();
      const isSimpleSignature = signatureMode === 'SIMPLE';
      const useLocalCertificate = signatureMode === 'QUALIFIED' && hasLocalCertificate;
      
      // Prescription mode uses QUALIFIED (ICP-Brasil) for legal compliance with Lei 14.063/2020
      const effectiveSignatureMode = isPrescriptionMode ? 'QUALIFIED' : signatureMode;

      if (useLocalCertificate) {
        // Sign with user's local A1 certificate for QUALIFIED signatures
        console.log('[QUALIFIED] Using local A1 certificate for company signer');
        
        try {
          for (const docId of documentIds) {
            const { data: signResult, error: signError } = await supabase.functions.invoke('sign-with-local-certificate', {
              body: {
                documentId: docId,
                userId: user.id,
              }
            });

            if (signError) {
              console.error('Local certificate signing failed:', signError);
              throw new Error('Erro ao assinar com certificado digital: ' + signError.message);
            }
            
            console.log('[QUALIFIED] Document signed with local certificate:', signResult);
          }
          
          // For external signers (if any), still send them to sign via BRy or internal flow
          // External signers will use SIMPLE signature mode
          if (signers.length > 0) {
            console.log('[QUALIFIED] Sending notifications to external signers for SIMPLE signature');
            // External signers will use the internal /assinar/:documentId flow
          }
          
          toast({
            title: "Documento assinado!",
            description: "O documento foi assinado com seu certificado digital."
          });

          // Send notifications to external signers if any
          for (const signer of signers) {
            try {
              if (signer.email) {
                await supabase.functions.invoke('send-signature-email', {
                  body: {
                    signerName: signer.name,
                    signerEmail: signer.email,
                    documentName: effectiveTitle,
                    documentId: documentIds[0],
                    senderName: companySigner.name,
                    organizationName: companySigner.companyName,
                    userId: user.id,
                    brySignerLink: null // External signers use internal flow
                  }
                });
              }

              if (signer.phone) {
                await supabase.functions.invoke('send-whatsapp-message', {
                  body: {
                    signerName: signer.name,
                    signerPhone: signer.phone,
                    documentName: effectiveTitle,
                    documentId: documentIds[0],
                    organizationName: companySigner.companyName,
                    brySignerLink: null
                  }
                });
              }
            } catch (notifError) {
              console.error('Failed to send notification:', notifError);
            }
          }

          setIsSubmitted(true);
          setIsSubmitting(false);
          navigate("/documentos?tab=pending-internal");
          return;
        } catch (localSignError: any) {
          console.error('Error signing with local certificate:', localSignError);
          toast({
            title: "Erro na assinatura",
            description: localSignError.message || "Erro ao assinar com certificado digital",
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      } else if (!isSimpleSignature) {
        // Create BRy envelope for ADVANCED/QUALIFIED (without local cert)/PRESCRIPTION signatures
        // For prescription mode, only company signer
        const allSigners = isPrescriptionMode 
          ? [{
              name: companySigner.name,
              email: companySigner.email,
              phone: companySigner.phone
            }]
          : [{
              name: companySigner.name,
              email: companySigner.email,
              phone: companySigner.phone
            }, ...signers];

        const documentsForBry = fileContents.map(fc => ({
          documentId: fc.docId,
          base64: fc.base64,
          fileName: filesToUpload.find(f => documentIds.indexOf(fc.docId) !== -1)?.name || effectiveTitle,
        }));

        console.log('[BRy] Creating envelope for', effectiveSignatureMode, 'signature with', documentsForBry.length, 'documents');

        const {
          data: bryData,
          error: bryError
        } = await supabase.functions.invoke('bry-create-envelope', {
          body: {
            documents: documentsForBry,
            title: effectiveTitle,
            signers: allSigners,
            userId: user.id,
            authenticationOptions: isPrescriptionMode ? ['IP'] : ['IP', 'GEOLOCATION', ...authOptions],
            signatureMode: effectiveSignatureMode
          }
        });

        // CRITICAL: Block document creation if BRy fails for non-SIMPLE modes
        if (bryError || !bryData?.signerLinks || bryData.signerLinks.length === 0) {
          console.error('[BRy] Envelope creation FAILED:', bryError || 'No signer links returned');
          console.error('[BRy] Response data:', bryData);
          
          toast({
            title: "Erro na integração de assinatura",
            description: "Não foi possível criar o envelope de assinatura digital. Verifique se as credenciais BRy estão configuradas corretamente ou tente novamente.",
            variant: "destructive"
          });
          
          // Clean up created documents since BRy failed
          for (const docId of documentIds) {
            await supabase.from('document_signers').delete().eq('document_id', docId);
            await supabase.from('documents').delete().eq('id', docId);
          }
          
          setIsSubmitting(false);
          return;
        }

        // Store signer links
        for (const link of bryData.signerLinks) {
          const key = link.email || link.phone;
          if (key) {
            brySignerLinks.set(key, link.link);
          }
        }
        console.log('[BRy] Envelope created successfully:', bryData.envelopeUuid, 'with', documentsForBry.length, 'documents');
        console.log('[BRy] Signer links:', Array.from(brySignerLinks.entries()));
      } else {
        console.log('SIMPLE signature mode - using native flow without BRy');
      }

      // For prescription mode: open BRy dialog directly
      if (isPrescriptionMode) {
        console.log('[PRESCRIPTION] Mode detected, opening BRy dialog. DocumentId:', firstDocumentId);
        
        if (!firstDocumentId) {
          console.error('[PRESCRIPTION] No document ID found');
          toast({
            title: "Erro",
            description: "Não foi possível criar o documento de prescrição.",
            variant: "destructive"
          });
          return;
        }
        
        // Get BRy signer link for company signer
        const bryLink = brySignerLinks.get(companySigner.email) || brySignerLinks.get(companySigner.phone);
        
        if (!bryLink) {
          console.error('[PRESCRIPTION] No BRy signer link found');
          toast({
            title: "Erro",
            description: "Não foi possível obter o link de assinatura.",
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
        
        // Set state to open BRy dialog directly
        setPrescriptionDocumentId(firstDocumentId);
        setPrescriptionDocumentName(effectiveTitle);
        setPrescriptionBryUrl(bryLink);
        setShowBryDialog(true);
        setIsSubmitted(true);
        setIsSubmitting(false);
        
        toast({
          title: "Prescrição criada!",
          description: "Abrindo interface de assinatura digital..."
        });
        return;
      }

      // Send notifications for non-prescription modes
      const allSignersForNotification = [{
        name: companySigner.name,
        email: companySigner.email,
        phone: companySigner.phone
      }, ...signers];

      for (const signer of allSignersForNotification) {
        try {
          // For SIMPLE mode, no BRy link - will use internal /assinar/:documentId
          const bryLink = isSimpleSignature ? null : (brySignerLinks.get(signer.email) || brySignerLinks.get(signer.phone));

          if (signer.email) {
            await supabase.functions.invoke('send-signature-email', {
              body: {
                signerName: signer.name,
                signerEmail: signer.email,
                documentName: effectiveTitle,
                documentId: firstDocumentId,
                senderName: companySigner.name,
                organizationName: companySigner.companyName,
                userId: user.id,
                brySignerLink: bryLink // null for SIMPLE, BRy link for others
              }
            });
          }

          if (signer.phone) {
            await supabase.functions.invoke('send-whatsapp-message', {
              body: {
                signerName: signer.name,
                signerPhone: signer.phone,
                documentName: effectiveTitle,
                documentId: firstDocumentId,
                organizationName: companySigner.companyName,
                brySignerLink: bryLink // null for SIMPLE, BRy link for others
              }
            });
          }
        } catch (error) {
          console.error(`Failed to send notification to ${signer.email || signer.phone}:`, error);
        }
      }

      setIsSubmitted(true);
      toast({
        title: filesToUpload.length >= 2 ? "Envelope enviado!" : "Documento enviado!",
        description: filesToUpload.length >= 2 
          ? `Envelope com ${filesToUpload.length} documentos enviado com sucesso. Os signatários receberão o convite por e-mail e WhatsApp.` 
          : "O documento foi enviado com sucesso e os signatários receberão o convite por e-mail e WhatsApp."
      });
      navigate("/documentos?tab=pending-internal");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar documento",
        description: error.message,
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  // Check if form is ready to submit
  const hasFileOrPrescription = files.length > 0 || (isPrescriptionMode && prescriptionContent.trim());
  const hasValidSigners = isPrescriptionMode || signers.some(signer => signer.name && (signer.phone || signer.email));

  // Handler for when prescription signing is completed via BRy
  const handlePrescriptionSigningComplete = async () => {
    setShowBryDialog(false);
    
    // Send prescription to patient after signing
    if (prescriptionDocumentId && patientInfo.name) {
      try {
        await supabase.functions.invoke('send-prescription-to-patient', {
          body: {
            documentId: prescriptionDocumentId,
            patientName: patientInfo.name,
            patientEmail: patientInfo.email || null,
            patientPhone: patientInfo.phone || null
          }
        });
        
        toast({
          title: "Prescrição assinada e enviada!",
          description: "A prescrição foi assinada digitalmente e enviada ao paciente."
        });
      } catch (error) {
        console.error('Error sending prescription to patient:', error);
        toast({
          title: "Prescrição assinada!",
          description: "A prescrição foi assinada. Não foi possível enviar ao paciente automaticamente."
        });
      }
    } else {
      toast({
        title: "Prescrição assinada!",
        description: "A assinatura digital foi aplicada com sucesso."
      });
    }
    
    navigate("/documentos?tab=pending-internal");
  };

  return <Layout>
      <div className="p-8 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-sm font-bold text-gray-600">Novo Documento</h1>
          <div className="mt-2 space-y-1">
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${hasFileOrPrescription ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: !hasFileOrPrescription ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            scale: {
              repeat: !hasFileOrPrescription ? Infinity : 0,
              duration: 2,
              ease: "easeInOut"
            }
          }}>
              <AnimatePresence mode="wait">
                {hasFileOrPrescription && <motion.div initial={{
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
              <span>{isPrescriptionMode ? 'Faça upload ou preencha a prescrição' : `Faça upload de 1 ou mais documentos (máx. ${MAX_DOCUMENTS})`}</span>
            </motion.div>
            
            {!isPrescriptionMode && (
              <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${hasValidSigners ? 'text-green-600' : 'text-gray-500'}`} initial={{
              opacity: 0,
              x: -10
            }} animate={{
              opacity: 1,
              x: 0,
              scale: hasFileOrPrescription && !hasValidSigners ? [1, 1.02, 1] : 1
            }} transition={{
              duration: 0.3,
              delay: 0.1,
              scale: {
                repeat: hasFileOrPrescription && !hasValidSigners ? Infinity : 0,
                duration: 2,
                ease: "easeInOut"
              }
            }}>
                <AnimatePresence mode="wait">
                  {hasValidSigners && <motion.div initial={{
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
            )}
            
            <motion.div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${isSubmitted ? 'text-green-600' : 'text-gray-500'}`} initial={{
            opacity: 0,
            x: -10
          }} animate={{
            opacity: 1,
            x: 0,
            scale: hasFileOrPrescription && hasValidSigners && !isSubmitted ? [1, 1.02, 1] : 1
          }} transition={{
            duration: 0.3,
            delay: 0.2,
            scale: {
              repeat: hasFileOrPrescription && hasValidSigners && !isSubmitted ? Infinity : 0,
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
          {/* 1. Signature Mode Section - FIRST */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-600">Tipo de Assinatura</Label>
            <RadioGroup value={signatureMode} onValueChange={(value) => setSignatureMode(value as SignatureMode)} className="space-y-2">
              {SIGNATURE_MODES
                .filter(mode => mode.id !== 'PRESCRIPTION' || isHealthcareProfessional)
                .map(mode => (
                <div
                  key={mode.id}
                  onClick={() => setSignatureMode(mode.id)}
                  className={`px-3 py-3 rounded cursor-pointer transition-colors ${
                    signatureMode === mode.id 
                      ? mode.id === 'PRESCRIPTION'
                        ? 'bg-purple-100 border border-purple-300'
                        : 'bg-primary/10 border border-primary/30' 
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

          {/* 2. Drag and Drop Area - SECOND */}
          <div className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${dragActive ? "border-primary bg-primary/10 scale-[1.02] shadow-lg" : "border-muted-foreground/25 hover:border-primary/50"}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            {files.length === 0 ? <>
                <Upload className={`w-12 h-12 mx-auto mb-4 transition-all duration-300 ${dragActive ? "text-primary scale-110" : "text-muted-foreground"}`} />
                <p className="font-medium mb-2 text-base text-gray-600">
                  Arraste e solte seu documento
                </p>
                <p className="text-sm text-muted-foreground mb-4">ou</p>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-100 rounded-full shadow-none border-transparent bg-blue-700 text-white hover:bg-blue-700 hover:text-white">
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

          {/* Prescription Fill Button - Only for Prescription Mode */}
          {isPrescriptionMode && (
            <div className="flex justify-center">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowPrescriptionSheet(true)}
                className={`rounded-full border-purple-300 ${prescriptionContent ? 'bg-purple-200 text-purple-800' : 'bg-purple-100 text-purple-700'} hover:bg-purple-200 hover:text-purple-800`}
              >
                <FileEdit className="w-4 h-4 mr-2" />
                {prescriptionContent ? 'Editar Prescrição' : 'Preencher Prescrição'}
              </Button>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid gap-6">
            {/* 3. Title - THIRD */}
            <div className="grid gap-1">
              <Label htmlFor="title">Título do Documento</Label>
              <p className="text-xs text-muted-foreground">Opcional - Usa nome do arquivo</p>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" className="placeholder:text-xs mt-1" />
            </div>

            {/* 4. Signers Section - Only for non-prescription modes */}
            {!isPrescriptionMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-600">Signatários</p>
                </div>
                {signers.map((signer, index) => <div key={index} className="relative p-4 border rounded-lg space-y-3 bg-muted">
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
                        onSelectGroup={(members) => {
                          setSigners(members.map(m => ({
                            name: m.name,
                            phone: m.phone,
                            email: m.email
                          })));
                        }}
                        suggestions={signerSuggestions}
                        groups={signerGroups}
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
            )}
          </div>

          {/* Security Options Section for SIMPLE mode */}
          {signatureMode === 'SIMPLE' && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-600">Segurança Adicional (Opcional)</Label>
              <div className="space-y-2">
                <div 
                  onClick={() => setRequireFacialBiometry(!requireFacialBiometry)} 
                  className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer bg-sidebar-foreground"
                >
                  <Checkbox 
                    checked={requireFacialBiometry} 
                    onClick={e => e.stopPropagation()} 
                    onCheckedChange={() => setRequireFacialBiometry(!requireFacialBiometry)} 
                  />
                  <span className="text-sm text-gray-600">Biometria Facial (Selfie)</span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                IP e Geolocalização são sempre capturados. A biometria facial adiciona uma camada extra de verificação.
              </p>
            </div>
          )}

          {/* Authentication Options Section - Only for BRy modes (not SIMPLE or PRESCRIPTION) */}
          {signatureMode !== 'SIMPLE' && signatureMode !== 'PRESCRIPTION' && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-600">Níveis de Verificação</Label>
              <div className="space-y-2">
                {AUTHENTICATION_OPTIONS.map(option => {
                  const isSelected = authOptions.includes(option.id);
                  return (
                    <div key={option.id} onClick={() => toggleAuthOption(option.id)} className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer bg-sidebar-foreground">
                      <Checkbox checked={isSelected} onClick={e => e.stopPropagation()} onCheckedChange={() => toggleAuthOption(option.id)} />
                      <span className="text-sm text-gray-600">{option.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="cancel" className="flex-1 gap-2" onClick={() => navigate("/documentos")}>
              <X className="w-4 h-4" />
              Cancelar
            </Button>
            <Button variant="confirm" className="flex-1 gap-2" onClick={handleSubmit} disabled={showLimitDialog || isSubmitting}>
              <AnimatePresence mode="wait" initial={false}>
                {isSubmitting ? (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="send"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Send className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
              Assinar
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
            <Button variant="cancel" onClick={() => navigate("/documentos")}>
              <X className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={() => navigate("/configuracoes?tab=subscription")} className="bg-gradient-to-r from-[#273d60] to-[#001f3f] rounded-full">
              Fazer Upgrade
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Prescription Sheet */}
      <Sheet open={showPrescriptionSheet} onOpenChange={setShowPrescriptionSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Preencher Prescrição</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">

            {/* Prescription Document Type Selector */}
            <div className="space-y-2">
              <Label htmlFor="prescription-type">Tipo de Documento</Label>
              <Select value={prescriptionDocType} onValueChange={(value) => setPrescriptionDocType(value as PrescriptionDocType)}>
                <SelectTrigger className="text-gray-600">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PRESCRIPTION_DOC_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Patient Info Section */}
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-gray-600">Dados do Paciente</p>
              
              <div className="grid gap-2">
                <Label htmlFor="patient-name">Nome do Paciente</Label>
                <PatientAutocomplete
                  value={patientInfo.name}
                  onChange={(value) => setPatientInfo(prev => ({ ...prev, name: value }))}
                  onSelectPatient={(patient) => {
                    setPatientInfo({
                      name: patient.name,
                      cpf: patient.cpf,
                      birthDate: patient.birthDate,
                      phone: patient.phone || '',
                      email: patient.email || ''
                    });
                  }}
                  suggestions={patientSuggestions}
                  placeholder="Nome completo do paciente"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="patient-cpf">CPF</Label>
                  <Input 
                    id="patient-cpf"
                    value={patientInfo.cpf}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, cpf: formatCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="placeholder:text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="patient-birth">Data de Nascimento</Label>
                  <Input 
                    id="patient-birth"
                    value={patientInfo.birthDate}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, birthDate: formatBirthDate(e.target.value) }))}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className="placeholder:text-xs"
                  />
                </div>
              </div>

              {/* Patient contact fields (optional) */}
              <div className="space-y-2 pt-2 border-t border-blue-200">
                <p className="text-xs text-blue-600 font-medium">Contato para envio (opcional)</p>
                <div className="grid gap-2">
                  <Label htmlFor="patient-phone">Telefone</Label>
                  <Input 
                    id="patient-phone"
                    value={patientInfo.phone}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    placeholder="(00)00000-0000"
                    maxLength={14}
                    inputMode="tel"
                    className="placeholder:text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="patient-email">E-mail</Label>
                  <Input 
                    id="patient-email"
                    type="email"
                    value={patientInfo.email}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                    className="placeholder:text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Prescription Content */}
            <div className="space-y-2">
              <Label htmlFor="prescription-content">Conteúdo da Prescrição</Label>
              <Textarea 
                id="prescription-content"
                value={prescriptionContent}
                onChange={(e) => setPrescriptionContent(e.target.value)}
                placeholder="Digite aqui o conteúdo da prescrição médica..."
                className="min-h-[200px] resize-none"
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button 
              variant="confirm"
              onClick={() => setShowPrescriptionSheet(false)}
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* BRy Signing Dialog for Prescriptions */}
      {prescriptionBryUrl && prescriptionDocumentId && (
        <BrySigningDialog
          open={showBryDialog}
          onOpenChange={setShowBryDialog}
          signingUrl={prescriptionBryUrl}
          documentName={prescriptionDocumentName}
          documentId={prescriptionDocumentId}
          onSigningComplete={handlePrescriptionSigningComplete}
        />
      )}
    </Layout>;
};
export default NewDocument;
