import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Download, PenTool, Trash2, Mail, FileCheck, ShieldCheck, FolderOpen, FileText, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { EnvelopeDocumentsDialog } from "./EnvelopeDocumentsDialog";
import { BrySigningDialog } from "./BrySigningDialog";
import { CertificatePreviewDialog } from "./CertificatePreviewDialog";
import JSZip from "jszip";

export interface EnvelopeDocument {
  id: string;
  name: string;
  file_url: string | null;
  status: string;
  signed_by: number;
  signers: number;
  bry_signed_file_url?: string | null;
  bry_envelope_uuid?: string | null;
}

export interface Document {
  id: string;
  name: string;
  createdAt: string;
  status: "pending" | "signed" | "expired" | "in_progress";
  signers: number;
  signedBy: number;
  signerStatuses?: ("signed" | "pending" | "rejected")[];
  signerNames?: string[];
  signerEmails?: string[];
  signerPhones?: string[];
  folderId?: string | null;
  fileUrl?: string | null;
  bryEnvelopeUuid?: string | null;
  isEnvelope?: boolean;
  documentCount?: number;
  envelopeId?: string | null;
  envelopeDocuments?: EnvelopeDocument[];
  signatureMode?: "SIMPLE" | "ADVANCED" | "QUALIFIED" | null;
}

export interface Folder {
  id: string;
  name: string;
  parent_folder_id: string | null;
}

interface DocumentsTableProps {
  documents: Document[];
  showProgress?: boolean;
  folders?: Folder[];
  allFolders?: Folder[];
  onDocumentMoved?: () => void;
  showFolderActions?: boolean;
  onRefresh?: () => void;
}

const statusConfig = {
  pending: {
    color: "bg-yellow-700",
    label: "Pendente"
  },
  signed: {
    color: "bg-green-700",
    label: "Assinado"
  },
  expired: {
    color: "bg-red-700",
    label: "Expirado"
  },
  in_progress: {
    color: "bg-blue-700",
    label: "Em andamento"
  }
};

const signatureModeConfig = {
  SIMPLE: {
    label: "Simples",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100"
  },
  ADVANCED: {
    label: "Avançada",
    className: "bg-purple-100 text-purple-700 hover:bg-purple-100"
  },
  QUALIFIED: {
    label: "Qualificada",
    className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
  }
};

const getInitials = (name: string) => {
  if (!name) return "??";
  const names = name.split(" ").filter(n => n.length > 0);
  if (names.length >= 2) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const DocumentsTable = ({
  documents,
  showProgress = true,
  folders = [],
  allFolders = [],
  onDocumentMoved,
  showFolderActions = true,
  onRefresh
}: DocumentsTableProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Envelope documents dialog state
  const [envelopeDialogOpen, setEnvelopeDialogOpen] = useState(false);
  const [selectedEnvelope, setSelectedEnvelope] = useState<{ title: string; documents: EnvelopeDocument[] } | null>(null);
  
  // BRy signing dialog state
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signingDocumentName, setSigningDocumentName] = useState("");
  const [signingDocumentId, setSigningDocumentId] = useState<string | null>(null);
  
  // Certificate preview dialog state
  const [certificatePreviewOpen, setCertificatePreviewOpen] = useState(false);
  const [certificatePdfUrl, setCertificatePdfUrl] = useState<string | null>(null);
  const [certificateDocumentName, setCertificateDocumentName] = useState("");
  const certificatePdfRef = useRef<jsPDF | null>(null);

  const handleOpenEnvelopeDialog = (doc: Document) => {
    if (doc.isEnvelope && doc.envelopeDocuments && doc.envelopeDocuments.length > 0) {
      setSelectedEnvelope({
        title: doc.name,
        documents: doc.envelopeDocuments,
      });
      setEnvelopeDialogOpen(true);
    }
  };

  // Organize folders hierarchically
  const organizeHierarchicalFolders = () => {
    const parentFolders = folders.filter(f => !f.parent_folder_id);
    const result: Array<{ folder: Folder; level: number }> = [];
    
    parentFolders.forEach(parent => {
      result.push({ folder: parent, level: 0 });
      const children = folders.filter(f => f.parent_folder_id === parent.id);
      children.forEach(child => {
        result.push({ folder: child, level: 1 });
      });
    });
    
    return result;
  };
  
  const hierarchicalFolders = organizeHierarchicalFolders();

  const handleMoveToFolder = async (documentId: string, folderId: string) => {
    try {
      const { error } = await supabase
        .from("documents")
        .update({ folder_id: folderId })
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Documento movido",
        description: "O documento foi movido para a pasta selecionada.",
      });

      if (onDocumentMoved) {
        onDocumentMoved();
      }
    } catch (error: any) {
      console.error("Error moving document:", error);
      toast({
        title: "Erro ao mover documento",
        description: error.message || "Não foi possível mover o documento.",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, documentId: string) => {
    e.dataTransfer.setData("documentId", documentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    // Clean up any drag state if needed
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      // First try to get the signed file URL, then fall back to original
      const { data: doc, error } = await supabase
        .from("documents")
        .select("file_url, bry_signed_file_url")
        .eq("id", documentId)
        .single();

      if (error) throw error;

      // Prefer signed file, fallback to original
      const fileUrl = doc.bry_signed_file_url || doc.file_url;
      
      if (!fileUrl) {
        toast({
          title: "Arquivo não encontrado",
          description: "O documento não possui arquivo associado.",
          variant: "destructive",
        });
        return;
      }

      // Generate signed URL for private bucket
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from("documents")
        .createSignedUrl(fileUrl, 3600);

      if (signedUrlError) throw signedUrlError;

      window.open(signedUrlData.signedUrl, "_blank");
    } catch (error: any) {
      console.error("Error viewing document:", error);
      toast({
        title: "Erro ao visualizar documento",
        description: error.message || "Não foi possível visualizar o documento.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadDocument = async (documentId: string) => {
    try {
      const { data: doc, error } = await supabase
        .from("documents")
        .select("name, file_url, bry_signed_file_url")
        .eq("id", documentId)
        .single();

      if (error) throw error;

      // Prefer signed file, fallback to original
      const fileUrl = doc.bry_signed_file_url || doc.file_url;
      
      if (!fileUrl) {
        toast({
          title: "Arquivo não encontrado",
          description: "O documento não possui arquivo associado.",
          variant: "destructive",
        });
        return;
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from("documents")
        .createSignedUrl(fileUrl, 3600);

      if (signedUrlError) throw signedUrlError;

      // Create a link to download
      const link = document.createElement("a");
      link.href = signedUrlData.signedUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download iniciado",
        description: "O documento está sendo baixado.",
      });
    } catch (error: any) {
      console.error("Error downloading document:", error);
      toast({
        title: "Erro ao baixar documento",
        description: error.message || "Não foi possível baixar o documento.",
        variant: "destructive",
      });
    }
  };

  const handleSignDocument = async (documentId: string) => {
    try {
      // First, fetch the document to check signature_mode and BRy signer link
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("name, signature_mode")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;

      // For SIMPLE signature mode, navigate to internal signing page
      if (doc.signature_mode === "SIMPLE") {
        navigate(`/assinar/${documentId}`);
        return;
      }

      // For ADVANCED/QUALIFIED modes, check for BRy signer link
      // Get current user's email to find their signer record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado.",
          variant: "destructive",
        });
        return;
      }

      // Get the user's company settings to find their admin email
      const { data: companySettings, error: companyError } = await supabase
        .from("company_settings")
        .select("admin_email")
        .eq("user_id", user.id)
        .single();

      if (companyError) throw companyError;

      // Find the signer record for this user (company signer)
      const { data: signer, error: signerError } = await supabase
        .from("document_signers")
        .select("bry_signer_link")
        .eq("document_id", documentId)
        .eq("email", companySettings.admin_email)
        .single();

      if (signerError) throw signerError;

      if (signer?.bry_signer_link) {
        // Open BRy signing interface in modal dialog
        setSigningUrl(signer.bry_signer_link);
        setSigningDocumentName(doc.name);
        setSigningDocumentId(documentId);
        setSigningDialogOpen(true);
      } else {
        // Fallback to old signing method
        navigate(`/assinar/${documentId}`);
      }
    } catch (error: any) {
      console.error("Error signing document:", error);
      toast({
        title: "Erro ao assinar documento",
        description: error.message || "Não foi possível iniciar a assinatura.",
        variant: "destructive",
      });
    }
  };

  const handleSigningComplete = () => {
    setSigningDialogOpen(false);
    setSigningUrl(null);
    setSigningDocumentName("");
    setSigningDocumentId(null);
    
    // Refresh the documents list
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleDeleteDocument = async (documentId: string, signedBy: number) => {
    if (signedBy > 0) {
      toast({
        title: "Não é possível excluir",
        description: "Documentos com assinaturas não podem ser excluídos.",
        variant: "destructive",
      });
      return;
    }

    // Ask for confirmation
    const confirmed = window.confirm("Tem certeza que deseja excluir este documento? Esta ação também notificará os signatários sobre o cancelamento.");
    if (!confirmed) return;

    try {
      // Get document name and signers for notification
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("name, file_url")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;

      // Get pending signers to notify them
      const { data: signers, error: signersError } = await supabase
        .from("document_signers")
        .select("name, email, phone, is_company_signer")
        .eq("document_id", documentId)
        .eq("status", "pending");

      if (signersError) throw signersError;

      // Get company settings for organization name
      const { data: { user } } = await supabase.auth.getUser();
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name")
        .eq("user_id", user?.id)
        .single();

      // Send cancellation notifications to pending signers (excluding company signer)
      const externalSigners = signers?.filter(s => !s.is_company_signer) || [];
      
      for (const signer of externalSigners) {
        // Send email notification
        if (signer.email) {
          try {
            await supabase.functions.invoke('send-signature-email', {
              body: {
                signerName: signer.name,
                signerEmail: signer.email,
                documentName: doc.name,
                organizationName: companySettings?.company_name || 'Organização',
                signatureUrl: '', // Empty URL for cancellation
                isCancellation: true
              }
            });
          } catch (emailError) {
            console.error("Error sending cancellation email:", emailError);
          }
        }

        // Send WhatsApp notification
        if (signer.phone) {
          try {
            await supabase.functions.invoke('send-whatsapp-message', {
              body: {
                signerName: signer.name,
                signerPhone: signer.phone,
                documentName: doc.name,
                organizationName: companySettings?.company_name || 'Organização',
                signatureUrl: '', // Empty URL for cancellation
                documentId,
                isCancellation: true
              }
            });
          } catch (whatsappError) {
            console.error("Error sending cancellation WhatsApp:", whatsappError);
          }
        }
      }

      // Delete the file from storage if exists
      if (doc.file_url) {
        await supabase.storage.from("documents").remove([doc.file_url]);
      }

      // Delete document signers first (due to foreign key)
      const { error: signersDeleteError } = await supabase
        .from("document_signers")
        .delete()
        .eq("document_id", documentId);

      if (signersDeleteError) throw signersDeleteError;

      // Delete the document
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Documento excluído",
        description: "O documento foi excluído e os signatários foram notificados.",
      });

      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast({
        title: "Erro ao excluir documento",
        description: error.message || "Não foi possível excluir o documento.",
        variant: "destructive",
      });
    }
  };

  const handleResendNotifications = async (documentId: string) => {
    try {
      toast({
        title: "Reenviando notificações...",
        description: "Aguarde enquanto reenviamos os convites.",
      });

      // Get document info
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("name")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;

      // Get pending signers
      const { data: signers, error: signersError } = await supabase
        .from("document_signers")
        .select("id, name, email, phone, bry_signer_link, is_company_signer")
        .eq("document_id", documentId)
        .eq("status", "pending");

      if (signersError) throw signersError;

      // Get company settings
      const { data: { user } } = await supabase.auth.getUser();
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name")
        .eq("user_id", user?.id)
        .single();

      let sentCount = 0;

      for (const signer of signers || []) {
        // Skip company signer - they can sign from the platform
        if (signer.is_company_signer) continue;

        const signatureUrl = signer.bry_signer_link || `${window.location.origin}/assinar/${documentId}`;

        // Send email
        if (signer.email) {
          try {
            await supabase.functions.invoke('send-signature-email', {
              body: {
                signerName: signer.name,
                signerEmail: signer.email,
                documentName: doc.name,
                organizationName: companySettings?.company_name || 'Organização',
                signatureUrl
              }
            });
            sentCount++;
          } catch (emailError) {
            console.error("Error sending email to", signer.email, emailError);
          }
        }

        // Send WhatsApp
        if (signer.phone) {
          try {
            await supabase.functions.invoke('send-whatsapp-message', {
              body: {
                signerName: signer.name,
                signerPhone: signer.phone,
                documentName: doc.name,
                organizationName: companySettings?.company_name || 'Organização',
                signatureUrl,
                documentId
              }
            });
          } catch (whatsappError) {
            console.error("Error sending WhatsApp to", signer.phone, whatsappError);
          }
        }
      }

      toast({
        title: "Notificações reenviadas",
        description: `Convites reenviados para ${sentCount} signatário(s) pendente(s).`,
      });
    } catch (error: any) {
      console.error("Error resending notifications:", error);
      toast({
        title: "Erro ao reenviar notificações",
        description: error.message || "Não foi possível reenviar as notificações.",
        variant: "destructive",
      });
    }
  };

  const formatCpf = (cpf: string | null) => {
    if (!cpf) return "N/A";
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length === 11) {
      return `***.***.${cleanCpf.slice(6, 9)}-**`;
    }
    if (cleanCpf.length === 14) {
      return `**.***.***/****-${cleanCpf.slice(12, 14)}`;
    }
    return cpf;
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "N/A";
    return phone;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleDownloadCertificatePDF = async (documentId: string) => {
    try {
      toast({
        title: "Gerando certificado...",
        description: "Aguarde enquanto preparamos a página de validação.",
      });

      // Fetch document and signers data
      const { data: document, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;

      const { data: signers, error: signersError } = await supabase
        .from("document_signers")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });

      if (signersError) throw signersError;

      // Get company settings for organization info
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name, logo_url")
        .eq("user_id", document.user_id)
        .single();

      // Create PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Color definitions
      const gray300: [number, number, number] = [209, 213, 219];
      const gray600: [number, number, number] = [75, 85, 99];
      const greenColor: [number, number, number] = [21, 128, 61];

      // Header background
      pdf.setFillColor(gray300[0], gray300[1], gray300[2]);
      pdf.rect(0, 0, pageWidth, 32, 'F');

      // System logo (left aligned)
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject(new Error("Failed to load logo"));
          logoImg.src = `${window.location.origin}/logo-eon-gray.png`;
        });
        pdf.addImage(logoImg, "PNG", margin, 8, 30, 16);
      } catch (logoError) {
        console.error("Error loading logo:", logoError);
      }

      // Title - right aligned
      pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("RELATÓRIO DE ASSINATURAS", pageWidth - margin, 22, { align: "right" });

      let yPos = 42;

      // Document Information Card
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(217, 217, 217);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 50, 2, 2, 'FD');

      pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("INFORMAÇÕES DO DOCUMENTO", margin + 5, yPos + 10);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const infoStartY = yPos + 20;
      
      pdf.text(`Documento: ${document.name}`, margin + 5, infoStartY);
      pdf.text(`Organização: ${companySettings?.company_name || "N/A"}`, margin + 5, infoStartY + 8);
      pdf.text(`Status: ${document.status === "signed" ? "Assinado" : "Pendente"}`, margin + 5, infoStartY + 16);
      pdf.text(`Criado em: ${formatDate(document.created_at)}`, margin + 5, infoStartY + 24);
      
      if (document.status === "signed") {
        const lastSignature = signers?.filter(s => s.signed_at).sort((a, b) => 
          new Date(b.signed_at!).getTime() - new Date(a.signed_at!).getTime()
        )[0];
        pdf.text(`Concluído em: ${formatDate(lastSignature?.signed_at || document.updated_at)}`, pageWidth / 2, infoStartY + 8);
      }

      yPos += 60;

      // Signers Section
      pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("SIGNATÁRIOS", margin, yPos);
      yPos += 12;

      signers.forEach((signer: any, index: number) => {
        if (yPos > pageHeight - 70) {
          pdf.addPage();
          yPos = 20;
          
          pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.text("SIGNATÁRIOS (continuação)", margin, yPos);
          yPos += 12;
        }

        // Signer card
        const cardHeight = 55;
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(217, 217, 217);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, cardHeight, 2, 2, 'FD');

        // Signer number badge with name - extended gray300 background
        pdf.setFillColor(gray300[0], gray300[1], gray300[2]);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 12, 2, 2, 'F');
        
        pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Signatário ${index + 1}`, margin + 3, yPos + 8);

        // Signer name - on same gray background
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text(signer.name || "N/A", margin + 40, yPos + 8);

        // Signed status badge
        if (signer.status === "signed") {
          pdf.setTextColor(greenColor[0], greenColor[1], greenColor[2]);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.text("Assinado", pageWidth - margin - 20, yPos + 8);
        }

        // Signer details - two columns
        const lineHeight = 7;
        let leftY = yPos + 18;
        let rightY = yPos + 18;
        
        pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");

        // Left column
        pdf.text(`CPF/CNPJ: ${formatCpf(signer.cpf)}`, margin + 5, leftY);
        leftY += lineHeight;
        pdf.text(`Nascimento: ${signer.birth_date ? formatDate(signer.birth_date).split(" ")[0] : "N/A"}`, margin + 5, leftY);
        leftY += lineHeight;
        pdf.text(`E-mail: ${signer.email || "N/A"}`, margin + 5, leftY);
        leftY += lineHeight;
        pdf.text(`Telefone: ${formatPhone(signer.phone)}`, margin + 5, leftY);

        // Right column
        const midX = pageWidth / 2;
        pdf.text(`IP: ${signer.signature_ip || "N/A"}`, midX, rightY);
        rightY += lineHeight;
        
        const location = signer.signature_city && signer.signature_state 
          ? `${signer.signature_city}, ${signer.signature_state}${signer.signature_country ? ` - ${signer.signature_country}` : ''}`
          : "N/A";
        pdf.text(`Local: ${location}`, midX, rightY);
        rightY += lineHeight;
        
        pdf.text(`Assinado em: ${signer.signed_at ? formatDate(signer.signed_at) : "Pendente"}`, midX, rightY);

        yPos += cardHeight + 8;
      });

      // QR Code section - bottom right (smaller size)
      const validationUrl = `${window.location.origin}/validar/${documentId}`;
      try {
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(validationUrl)}`;
        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = () => reject(new Error("Failed to load QR code"));
          qrImg.src = qrCodeUrl;
        });
        
        const qrX = pageWidth - margin - 28;
        const qrY = pageHeight - 48;
        pdf.addImage(qrImg, "PNG", qrX, qrY, 28, 28);
        
        // Text below QR code
        pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text("Validação", qrX + 14, qrY + 33, { align: "center" });
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text("Escaneie o QR Code", qrX + 14, qrY + 38, { align: "center" });
      } catch (qrError) {
        console.error("Error loading QR code:", qrError);
      }

      // Footer
      const footerY = pageHeight - 30;
      pdf.setDrawColor(217, 217, 217);
      pdf.line(margin, footerY, pageWidth - margin - 50, footerY);
      
      pdf.setTextColor(gray600[0], gray600[1], gray600[2]);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Documento validado pelo sistema Eon Sign", margin, footerY + 8);
      
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text("Este documento possui validade jurídica conforme Lei n. 14.063/2020 e MP 2.200-2/2001", margin, footerY + 15);

      // Generate blob URL for preview instead of downloading
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Store PDF reference for download
      certificatePdfRef.current = pdf;
      setCertificateDocumentName(document.name);
      setCertificatePdfUrl(pdfUrl);
      setCertificatePreviewOpen(true);
    } catch (error: any) {
      console.error("Error downloading certificate:", error);
      toast({
        title: "Erro ao baixar certificado",
        description: error.message || "Não foi possível gerar o certificado.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCertificateFromPreview = () => {
    if (certificatePdfRef.current && certificateDocumentName) {
      certificatePdfRef.current.save(`${certificateDocumentName}_validacao.pdf`);
      toast({
        title: "Certificado baixado",
        description: "Página de validação baixada com sucesso.",
      });
    }
  };

  const handleCloseCertificatePreview = (open: boolean) => {
    if (!open && certificatePdfUrl) {
      URL.revokeObjectURL(certificatePdfUrl);
      setCertificatePdfUrl(null);
      certificatePdfRef.current = null;
    }
    setCertificatePreviewOpen(open);
  };

  const handleDownloadReport = async (documentId: string) => {
    try {
      toast({
        title: "Baixando relatório...",
        description: "Obtendo relatório de evidências do BRy.",
      });

      const response = await supabase.functions.invoke('bry-download-report', {
        body: { documentId },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao baixar relatório');
      }

      // O response.data é um ArrayBuffer do PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const doc = documents.find(d => d.id === documentId);
      link.download = `${doc?.name || 'documento'}_evidencias.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download concluído",
        description: "Relatório de evidências baixado com sucesso.",
      });
    } catch (error: any) {
      console.error("Error downloading report:", error);
      toast({
        title: "Erro ao baixar relatório",
        description: error.message || "Não foi possível baixar o relatório de evidências.",
        variant: "destructive",
      });
    }
  };

  const handleOpenValidation = async (documentId: string) => {
    try {
      const response = await supabase.functions.invoke('bry-get-validation-url', {
        body: { documentId },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao obter URL de validação');
      }

      if (response.data?.validationUrl) {
        window.open(response.data.validationUrl, '_blank');
      }
    } catch (error: any) {
      console.error("Error getting validation URL:", error);
      toast({
        title: "Erro ao abrir validação",
        description: error.message || "Não foi possível abrir a página de validação.",
        variant: "destructive",
      });
    }
  };

  // Download all documents in an envelope as ZIP
  const handleDownloadEnvelope = async (doc: Document) => {
    if (!doc.isEnvelope || !doc.envelopeDocuments || doc.envelopeDocuments.length === 0) {
      toast({
        title: "Erro",
        description: "Este documento não é um envelope.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Preparando download...",
        description: `Baixando ${doc.envelopeDocuments.length} documentos.`,
      });

      const zip = new JSZip();

      for (const envDoc of doc.envelopeDocuments) {
        // Prefer signed file, fallback to original
        const fileUrl = envDoc.bry_signed_file_url || envDoc.file_url;
        if (!fileUrl) continue;

        const { data: signedUrlData, error: signedUrlError } = await supabase
          .storage
          .from("documents")
          .createSignedUrl(fileUrl, 3600);

        if (signedUrlError) {
          console.error("Error getting signed URL for", envDoc.name, signedUrlError);
          continue;
        }

        // Fetch the file
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) {
          console.error("Error fetching file:", envDoc.name);
          continue;
        }

        const blob = await response.blob();
        const fileName = envDoc.bry_signed_file_url 
          ? envDoc.name.replace('.pdf', '_assinado.pdf')
          : envDoc.name;
        zip.file(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, blob);
      }

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${doc.name.split(' - ')[0]}_documentos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download concluído",
        description: `ZIP com ${doc.envelopeDocuments.length} documentos baixado com sucesso.`,
      });
    } catch (error: any) {
      console.error("Error downloading envelope:", error);
      toast({
        title: "Erro ao baixar envelope",
        description: error.message || "Não foi possível baixar os documentos.",
        variant: "destructive",
      });
    }
  };

  // Download evidence report for envelope (uses first document's BRy envelope)
  const handleDownloadEnvelopeReport = async (doc: Document) => {
    // Report is per envelope, so just use the main doc ID
    handleDownloadReport(doc.id);
  };

  // View envelope documents (opens dialog)
  const handleViewEnvelopeDocuments = (doc: Document) => {
    if (doc.isEnvelope) {
      handleOpenEnvelopeDialog(doc);
    } else {
      handleViewDocument(doc.id);
    }
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-none bg-white hover:bg-white">
              <TableHead>Nome do Documento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assinaturas</TableHead>
              <TableHead className="w-[200px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc, index) => {
              const statusInfo = statusConfig[doc.status];
              const progressPercentage = doc.signedBy / doc.signers * 100;
              return (
                <TableRow key={doc.id} draggable onDragStart={e => handleDragStart(e, doc.id)} onDragEnd={handleDragEnd} className={`border-none ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:opacity-80`}>
                  <TableCell>
                    <div 
                      className={`flex items-center gap-2 ${doc.isEnvelope ? 'cursor-pointer hover:opacity-70' : ''}`}
                      onClick={() => doc.isEnvelope && handleOpenEnvelopeDialog(doc)}
                    >
                      {doc.isEnvelope ? (
                        <FolderOpen className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      )}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-600">{doc.name}</span>
                          {doc.isEnvelope && doc.documentCount && doc.documentCount > 1 && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              {doc.documentCount} docs
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">{doc.createdAt}</p>
                          {doc.signatureMode && signatureModeConfig[doc.signatureMode] && (
                            <Badge className={`${signatureModeConfig[doc.signatureMode].className} text-[10px] px-1.5 py-0`}>
                              {signatureModeConfig[doc.signatureMode].label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex items-center gap-1">
                        {doc.signerNames?.map((name, idx) => {
                          const status = doc.signerStatuses?.[idx] || 'pending';
                          const email = doc.signerEmails?.[idx] || '';
                          const phone = doc.signerPhones?.[idx] || '';
                          const bgColor = status === 'signed' ? 'bg-green-700' : status === 'rejected' ? 'bg-red-700' : 'bg-yellow-700';
                          return (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div className={`w-7 h-7 rounded-full ${bgColor} text-white text-xs font-medium flex items-center justify-center cursor-default transition-all duration-300 ease-in-out hover:scale-110`}>
                                  {getInitials(name)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="flex flex-col gap-0.5">
                                <p className="font-medium">{name}</p>
                                {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
                                <p className="text-xs text-muted-foreground">{email}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <Progress value={progressPercentage} className={`h-2 w-20 ${doc.status === 'expired' ? '[&>div]:bg-red-500' : '[&>div]:bg-[#273d60]'}`} />
                        <span className="text-sm text-gray-600 min-w-[40px]">
                          {doc.signedBy}/{doc.signers}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {doc.status !== 'signed' && doc.status !== 'expired' && (
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleSignDocument(doc.id)} title="Assinar documento">
                          <PenTool className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-transparent" 
                        onClick={() => doc.isEnvelope ? handleViewEnvelopeDocuments(doc) : handleViewDocument(doc.id)} 
                        title={doc.isEnvelope ? "Ver documentos do envelope" : "Visualizar documento"}
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-transparent" 
                        onClick={() => doc.isEnvelope ? handleDownloadEnvelope(doc) : handleDownloadDocument(doc.id)} 
                        title={doc.isEnvelope ? "Baixar todos os documentos (ZIP)" : "Baixar documento"}
                      >
                        {doc.isEnvelope ? (
                          <FileDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Download className="w-4 h-4 text-gray-500" />
                        )}
                      </Button>
                      {!doc.bryEnvelopeUuid && doc.signatureMode === 'SIMPLE' && doc.signedBy > 0 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => handleDownloadCertificatePDF(doc.id)}
                          title="Baixar página de validação em PDF"
                        >
                          <FileCheck className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      {doc.bryEnvelopeUuid && doc.signedBy > 0 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => doc.isEnvelope ? handleDownloadEnvelopeReport(doc) : handleDownloadReport(doc.id)}
                          title="Baixar PDF com evidências das assinaturas coletadas"
                        >
                          <FileCheck className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      {doc.bryEnvelopeUuid && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => handleOpenValidation(doc.id)}
                          title="Validar assinaturas no portal BRy"
                        >
                          <ShieldCheck className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      {!doc.bryEnvelopeUuid && doc.signatureMode === 'SIMPLE' && doc.signedBy > 0 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => window.open(`/validar/${doc.id}`, '_blank')}
                          title="Visualizar certificado de validação"
                        >
                          <ShieldCheck className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      {doc.status !== 'signed' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => handleResendNotifications(doc.id)}
                          title="Reenviar e-mail e WhatsApp para signatários pendentes"
                        >
                          <Mail className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      {doc.signedBy === 0 && (
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleDeleteDocument(doc.id, doc.signedBy)} title="Excluir documento">
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {documents.map((doc) => {
          const statusInfo = statusConfig[doc.status];
          const progressPercentage = doc.signedBy / doc.signers * 100;
          return (
            <div key={doc.id} className="bg-white rounded-lg p-4 space-y-3 shadow-sm border border-gray-100">
              {/* Document name and status */}
              <div className="flex items-start justify-between gap-2">
                <div 
                  className={`flex items-center gap-2 flex-1 ${doc.isEnvelope ? 'cursor-pointer' : ''}`}
                  onClick={() => doc.isEnvelope && handleOpenEnvelopeDialog(doc)}
                >
                  {doc.isEnvelope ? (
                    <FolderOpen className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-600">{doc.name}</p>
                      {doc.isEnvelope && doc.documentCount && doc.documentCount > 1 && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                          {doc.documentCount} docs
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">{doc.createdAt}</p>
                      {doc.signatureMode && signatureModeConfig[doc.signatureMode] && (
                        <Badge className={`${signatureModeConfig[doc.signatureMode].className} text-[10px] px-1.5 py-0`}>
                          {signatureModeConfig[doc.signatureMode].label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Signers badges */}
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  {doc.signerNames?.map((name, idx) => {
                    const status = doc.signerStatuses?.[idx] || 'pending';
                    const email = doc.signerEmails?.[idx] || '';
                    const phone = doc.signerPhones?.[idx] || '';
                    const bgColor = status === 'signed' ? 'bg-green-700' : status === 'rejected' ? 'bg-red-700' : 'bg-yellow-700';
                    return (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div className={`w-7 h-7 rounded-full ${bgColor} text-white text-xs font-medium flex items-center justify-center cursor-default`}>
                            {getInitials(name)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="flex flex-col gap-0.5">
                          <p className="font-medium">{name}</p>
                          {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
                          <p className="text-xs text-muted-foreground">{email}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              
              {/* Progress bar */}
              {showProgress && (
                <div className="flex items-center gap-3">
                  <Progress value={progressPercentage} className={`h-2 flex-1 ${doc.status === 'expired' ? '[&>div]:bg-red-500' : '[&>div]:bg-[#273d60]'}`} />
                  <span className="text-sm text-gray-600 min-w-[40px]">
                    {doc.signedBy}/{doc.signers}
                  </span>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                {doc.status !== 'signed' && doc.status !== 'expired' && (
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleSignDocument(doc.id)}>
                    <PenTool className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => doc.isEnvelope ? handleViewEnvelopeDocuments(doc) : handleViewDocument(doc.id)}>
                  <Eye className="w-4 h-4 text-gray-500" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => doc.isEnvelope ? handleDownloadEnvelope(doc) : handleDownloadDocument(doc.id)}>
                  {doc.isEnvelope ? (
                    <FileDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <Download className="w-4 h-4 text-gray-500" />
                  )}
                </Button>
                {!doc.bryEnvelopeUuid && doc.signatureMode === 'SIMPLE' && doc.signedBy > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-transparent" 
                    onClick={() => handleDownloadCertificatePDF(doc.id)}
                  >
                    <FileCheck className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                {doc.bryEnvelopeUuid && doc.signedBy > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-transparent" 
                    onClick={() => doc.isEnvelope ? handleDownloadEnvelopeReport(doc) : handleDownloadReport(doc.id)}
                  >
                    <FileCheck className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                {doc.bryEnvelopeUuid && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-transparent" 
                    onClick={() => handleOpenValidation(doc.id)}
                  >
                    <ShieldCheck className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                {!doc.bryEnvelopeUuid && doc.signatureMode === 'SIMPLE' && doc.signedBy > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-transparent" 
                    onClick={() => window.open(`/validar/${doc.id}`, '_blank')}
                  >
                    <ShieldCheck className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                {doc.status !== 'signed' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-transparent" 
                    onClick={() => handleResendNotifications(doc.id)}
                  >
                    <Mail className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
                {doc.signedBy === 0 && (
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleDeleteDocument(doc.id, doc.signedBy)}>
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
              </div>
              
              {/* Folder selection */}
              {showFolderActions && folders && folders.length > 0 && (
                <div className="pt-2">
                  <Select value={doc.folderId || ""} onValueChange={value => handleMoveToFolder(doc.id, value)}>
                    <SelectTrigger className="w-full hover:bg-gray-50">
                      <SelectValue placeholder="Selecionar pasta" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {hierarchicalFolders.map(({ folder, level }) => (
                        <SelectItem 
                          key={folder.id} 
                          value={folder.id} 
                          className="hover:bg-gray-50 focus:bg-gray-50 text-gray-700"
                          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
                        >
                          {level > 0 && "└─ "}{folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Envelope Documents Dialog */}
      <EnvelopeDocumentsDialog
        open={envelopeDialogOpen}
        onOpenChange={setEnvelopeDialogOpen}
        envelopeTitle={selectedEnvelope?.title || ''}
        documents={selectedEnvelope?.documents || []}
      />

      {/* BRy Signing Dialog */}
      <BrySigningDialog
        open={signingDialogOpen}
        onOpenChange={setSigningDialogOpen}
        signingUrl={signingUrl}
        documentName={signingDocumentName}
        documentId={signingDocumentId}
        onSigningComplete={handleSigningComplete}
      />

      {/* Certificate Preview Dialog */}
      <CertificatePreviewDialog
        open={certificatePreviewOpen}
        onOpenChange={handleCloseCertificatePreview}
        pdfUrl={certificatePdfUrl}
        documentName={certificateDocumentName}
        onDownload={handleDownloadCertificateFromPreview}
      />
    </>
  );
};
