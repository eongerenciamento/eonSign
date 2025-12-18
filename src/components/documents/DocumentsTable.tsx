import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Download, PenTool, Trash2, Mail, FileCheck, ShieldCheck, FolderOpen, FileText, FileDown, Loader2, ChevronRight, ChevronDown, Check, Folder } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { EnvelopeDocumentsDialog } from "./EnvelopeDocumentsDialog";
import { BrySigningDialog } from "./BrySigningDialog";
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
  signatureMode?: "SIMPLE" | "ADVANCED" | "QUALIFIED" | "PRESCRIPTION" | null;
  patientName?: string | null;
  prescriptionDocType?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parent_folder_id?: string | null;
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
    label: "Pendente",
    className: "bg-yellow-700 text-white hover:bg-yellow-700"
  },
  in_progress: {
    label: "Em Andamento",
    className: "bg-blue-700 text-white hover:bg-blue-700"
  },
  signed: {
    label: "Assinado",
    className: "bg-green-700 text-white hover:bg-green-700"
  },
  expired: {
    label: "Expirado",
    className: "bg-red-700 text-white hover:bg-red-700"
  }
};

const signatureModeConfig = {
  SIMPLE: {
    label: "Simples",
    className: "bg-transparent border border-blue-700 text-blue-700"
  },
  ADVANCED: {
    label: "Avançada",
    className: "bg-transparent border border-green-600 text-green-600"
  },
  QUALIFIED: {
    label: "ICP-Brasil",
    className: "bg-transparent border border-green-600 text-green-600"
  },
  PRESCRIPTION: {
    label: "Prescrição",
    className: "bg-transparent border border-pink-500 text-pink-500"
  }
};

// Map prescription doc types to readable labels
const prescriptionDocTypeLabels: Record<string, string> = {
  'MEDICAMENTO': 'Medicamento',
  'ATESTADO': 'Atestado',
  'SOLICITACAO_EXAME': 'Exame',
  'LAUDO': 'Laudo',
  'SUMARIA_ALTA': 'Alta',
  'ATENDIMENTO_CLINICO': 'Atendimento',
  'DISPENSACAO_MEDICAMENTO': 'Dispensação',
  'VACINACAO': 'Vacina',
  'RELATORIO_MEDICO': 'Relatório',
};

// Check if document is a prescription (by signature mode OR prescription doc type)
const isPrescription = (doc: { signatureMode?: string | null; prescriptionDocType?: string | null }) => {
  return doc.signatureMode === 'PRESCRIPTION' || !!doc.prescriptionDocType;
};
const getInitials = (name: string) => {
  const names = name.trim().split(' ');
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
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  
  // Envelope documents dialog state
  const [envelopeDialogOpen, setEnvelopeDialogOpen] = useState(false);
  const [selectedEnvelope, setSelectedEnvelope] = useState<{ title: string; documents: EnvelopeDocument[] } | null>(null);
  
  // BRy signing dialog state
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signingDocumentName, setSigningDocumentName] = useState("");
  const [signingDocumentId, setSigningDocumentId] = useState<string | null>(null);
  
  // Loading state for certificate download
  const [downloadingCertificateId, setDownloadingCertificateId] = useState<string | null>(null);

  const handleOpenEnvelopeDialog = (doc: Document) => {
    if (doc.isEnvelope && doc.envelopeDocuments && doc.envelopeDocuments.length > 0) {
      setSelectedEnvelope({
        title: doc.name,
        documents: doc.envelopeDocuments,
      });
      setEnvelopeDialogOpen(true);
    }
  };

  // State for expanded folders in dropdown
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // State for open folder popovers (keyed by document id)
  const [openFolderPopovers, setOpenFolderPopovers] = useState<Record<string, boolean>>({});

  // Toggle folder expansion
  const toggleFolderExpansion = (folderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // Handle folder selection (move document to folder)
  const handleFolderSelect = (documentId: string, folderId: string) => {
    handleMoveToFolder(documentId, folderId);
    setOpenFolderPopovers(prev => ({ ...prev, [documentId]: false }));
  };

  // Check if folder has children
  const folderHasChildren = (folderId: string) => {
    return folders.some(f => f.parent_folder_id === folderId);
  };

  // Organize folders hierarchically with visibility based on expanded state
  const organizeHierarchicalFolders = () => {
    const parentFolders = folders.filter(f => !f.parent_folder_id);
    const result: Array<{ folder: Folder; level: number; hasChildren: boolean; isVisible: boolean }> = [];
    
    parentFolders.forEach(parent => {
      const hasChildren = folderHasChildren(parent.id);
      result.push({ folder: parent, level: 0, hasChildren, isVisible: true });
      
      // Only add children if parent is expanded
      if (expandedFolders.has(parent.id)) {
        const children = folders.filter(f => f.parent_folder_id === parent.id);
        children.forEach(child => {
          result.push({ folder: child, level: 1, hasChildren: false, isVisible: true });
        });
      }
    });
    
    return result;
  };

  const hierarchicalFolders = organizeHierarchicalFolders();

  const handleSignDocument = async (documentId: string, documentName: string) => {
    try {
      // Buscar o link BRy do signatário da empresa
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate(`/assinar/${documentId}`);
        return;
      }

      const { data: companyData } = await supabase
        .from('company_settings')
        .select('admin_email')
        .eq('user_id', user.id)
        .single();

      if (companyData?.admin_email) {
        const { data: signerData } = await supabase
          .from('document_signers')
          .select('bry_signer_link')
          .eq('document_id', documentId)
          .eq('email', companyData.admin_email)
          .single();

        if (signerData?.bry_signer_link) {
          // Abrir modal com iframe BRy
          setSigningUrl(signerData.bry_signer_link);
          setSigningDocumentName(documentName);
          setSigningDocumentId(documentId);
          setSigningDialogOpen(true);
          return;
        }
      }

      // Fallback para método antigo
      navigate(`/assinar/${documentId}`);
    } catch (error) {
      console.error('Error getting BRy link:', error);
      navigate(`/assinar/${documentId}`);
    }
  };

  const handleSigningComplete = () => {
    // Refresh documents list after signing
    onRefresh?.();
  };

  const handleViewDocument = async (documentId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("documents")
      .select("file_url, status, bry_envelope_uuid, bry_signed_file_url")
      .eq("id", documentId)
      .single();

    if (error || !data) {
      toast({
        title: "Erro ao visualizar documento",
        description: "Não foi possível carregar o documento.",
        variant: "destructive",
      });
      return;
    }

    let filePath: string;

    // Se é documento BRy assinado com arquivo já salvo
    if (data.bry_envelope_uuid && data.status === 'signed' && data.bry_signed_file_url) {
      filePath = data.bry_signed_file_url;
    } else if (data.file_url) {
      // Extract path from URL for signed URL generation
      const urlParts = data.file_url.split('/storage/v1/object/public/documents/');
      if (urlParts.length < 2) {
        toast({
          title: "Erro ao visualizar documento",
          description: "URL do documento inválida.",
          variant: "destructive",
        });
        return;
      }
      filePath = urlParts[1];
    } else {
      toast({
        title: "Erro ao visualizar documento",
        description: "URL do documento não encontrada.",
        variant: "destructive",
      });
      return;
    }

    // Generate signed URL for private bucket
    const { data: signedData, error: signedError } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(filePath, 3600); // Valid for 1 hour

    if (signedError || !signedData?.signedUrl) {
      toast({
        title: "Erro ao visualizar documento",
        description: "Não foi possível gerar link de acesso.",
        variant: "destructive",
      });
      return;
    }

    window.open(signedData.signedUrl, "_blank");
  };

  const handleDownloadDocument = async (documentId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("documents")
      .select("file_url, name, status, bry_envelope_uuid, bry_signed_file_url")
      .eq("id", documentId)
      .single();

    if (error || !data) {
      toast({
        title: "Erro ao baixar documento",
        description: "Não foi possível carregar o documento.",
        variant: "destructive",
      });
      return;
    }

    let filePath: string;
    let downloadFileName = data.name;

    // Se é documento BRy assinado
    if (data.bry_envelope_uuid && data.status === 'signed') {
      // Se já temos o arquivo assinado salvo
      if (data.bry_signed_file_url) {
        filePath = data.bry_signed_file_url;
        downloadFileName = data.name.replace('.pdf', '_assinado.pdf');
      } else {
        // Baixar documento assinado do BRy
        toast({
          title: "Baixando documento assinado...",
          description: "Obtendo documento do BRy.",
        });

        try {
          const { data: bryData, error: bryError } = await supabase.functions.invoke('bry-download-signed', {
            body: { documentId },
          });

          if (bryError) {
            throw bryError;
          }

          if (bryData?.downloadUrl) {
            // Usar URL direta do BRy
            const response = await fetch(bryData.downloadUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = data.name.replace('.pdf', '_assinado.pdf');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast({
              title: "Download concluído",
              description: "Documento assinado baixado com sucesso.",
            });
            return;
          }

          filePath = bryData?.signedFileUrl;
          downloadFileName = data.name.replace('.pdf', '_assinado.pdf');
        } catch (err: any) {
          console.error('Error downloading BRy signed document:', err);
          toast({
            title: "Erro ao baixar documento assinado",
            description: err.message || "Não foi possível obter o documento assinado do BRy.",
            variant: "destructive",
          });
          return;
        }
      }
    } else {
      // Documento normal
      if (!data.file_url) {
        toast({
          title: "Erro ao baixar documento",
          description: "URL do documento não encontrada.",
          variant: "destructive",
        });
        return;
      }

      // Extract path from URL for signed URL generation
      const urlParts = data.file_url.split('/storage/v1/object/public/documents/');
      if (urlParts.length < 2) {
        toast({
          title: "Erro ao baixar documento",
          description: "URL do documento inválida.",
          variant: "destructive",
        });
        return;
      }
      filePath = urlParts[1];
    }

    // Generate signed URL for private bucket
    const { data: signedData, error: signedError } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(filePath, 3600); // Valid for 1 hour

    if (signedError || !signedData?.signedUrl) {
      toast({
        title: "Erro ao baixar documento",
        description: "Não foi possível gerar link de download.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(signedData.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download iniciado",
        description: "O documento está sendo baixado.",
      });
    } catch (err) {
      toast({
        title: "Erro ao baixar documento",
        description: "Não foi possível baixar o documento.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (documentId: string, signedBy: number) => {
    if (signedBy > 0) {
      toast({
        title: "Não é possível excluir",
        description: "Este documento já possui assinaturas e não pode ser excluído.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Tem certeza que deseja excluir este documento?")) {
      return;
    }

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId);

    if (error) {
      toast({
        title: "Erro ao excluir documento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Documento excluído",
        description: "O documento foi excluído com sucesso.",
      });
      if (onDocumentMoved) {
        onDocumentMoved();
      }
    }
  };
  const handleMoveToFolder = async (documentId: string, folderId: string) => {
    const {
      error
    } = await supabase.from("documents").update({
      folder_id: folderId
    }).eq("id", documentId);
    if (error) {
      toast({
        title: "Erro ao mover documento",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Documento movido",
        description: "O documento foi movido para a pasta com sucesso."
      });
      if (onDocumentMoved) {
        onDocumentMoved();
      }
    }
  };
  const handleRemoveFromFolder = async (documentId: string) => {
    const {
      error
    } = await supabase.from("documents").update({
      folder_id: null
    }).eq("id", documentId);
    if (error) {
      toast({
        title: "Erro ao remover documento",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Documento removido da pasta",
        description: "O documento foi removido da pasta com sucesso."
      });
      if (onDocumentMoved) {
        onDocumentMoved();
      }
    }
  };
  const handleDragStart = (e: React.DragEvent, documentId: string) => {
    e.dataTransfer.setData("documentId", documentId);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("opacity-50");
  };
  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50");
  };

  const handleResendNotifications = async (documentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get document details and signers
      const { data: documentData } = await supabase
        .from('documents')
        .select('*, document_signers(*)')
        .eq('id', documentId)
        .single();

      if (!documentData) {
        toast({
          title: "Erro",
          description: "Documento não encontrado.",
          variant: "destructive",
        });
        return;
      }

      // Get company settings
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!companyData) {
        toast({
          title: "Erro",
          description: "Configurações da empresa não encontradas.",
          variant: "destructive",
        });
        return;
      }

      // Send emails and WhatsApp to pending signers
      const pendingSigners = documentData.document_signers.filter(
        (signer: any) => signer.status === 'pending'
      );

      if (pendingSigners.length === 0) {
        toast({
          title: "Nenhum signatário pendente",
          description: "Todos os signatários já assinaram o documento.",
        });
        return;
      }

      toast({
        title: "Reenviando notificações",
        description: `Enviando para ${pendingSigners.length} signatário(s)...`,
      });

      // Send to each pending signer
      for (const signer of pendingSigners) {
        // Send email only if signer has email
        if (signer.email) {
          await supabase.functions.invoke('send-signature-email', {
            body: {
              signerEmail: signer.email,
              signerName: signer.name,
              documentName: documentData.name,
              documentId: documentData.id,
              organizationName: companyData.company_name,
              userId: user.id,
              brySignerLink: signer.bry_signer_link,
            },
          });
        }

        // Send WhatsApp only if signer has phone
        if (signer.phone) {
          await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              signerName: signer.name,
              signerPhone: signer.phone,
              documentName: documentData.name,
              documentId: documentData.id,
              organizationName: companyData.company_name,
              isCompleted: false,
              brySignerLink: signer.bry_signer_link,
            },
          });
        }
      }

      toast({
        title: "Notificações reenviadas",
        description: `Email e WhatsApp enviados para ${pendingSigners.length} signatário(s).`,
      });
    } catch (error) {
      console.error("Error resending notifications:", error);
      toast({
        title: "Erro ao reenviar",
        description: "Não foi possível reenviar as notificações.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCertificatePDF = async (documentId: string) => {
    setDownloadingCertificateId(documentId);
    try {
      // Use edge function for consistency with email attachment
      const { data: result, error } = await supabase.functions.invoke(
        "download-complete-document",
        { body: { documentId } }
      );

      if (error || result?.error) {
        throw new Error(result?.error || error?.message || 'Erro ao gerar documento completo');
      }

      if (!result?.pdfBytes) {
        throw new Error('Nenhum PDF gerado');
      }

      // Convert bytes array to blob
      const uint8Array = new Uint8Array(result.pdfBytes);
      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Use filename from response or fallback
      const fileName = result.fileName || 'documento_completo.pdf';
      
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Relatório baixado",
        description: "Relatório de assinaturas baixado com sucesso.",
      });
    } catch (error: any) {
      console.error("Error downloading certificate:", error);
      toast({
        title: "Erro ao baixar relatório",
        description: error.message || "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    } finally {
      setDownloadingCertificateId(null);
    }
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
      toast({
        title: "Obtendo link de validação...",
      });

      const { data, error } = await supabase.functions.invoke('bry-get-validation-url', {
        body: { documentId },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao obter URL de validação');
      }

      if (data?.validationUrl) {
        window.open(data.validationUrl, '_blank');
      } else {
        throw new Error('URL de validação não disponível');
      }
    } catch (error: any) {
      console.error("Error getting validation URL:", error);
      toast({
        title: "Erro ao obter validação",
        description: error.message || "Não foi possível obter o link de validação.",
        variant: "destructive",
      });
    }
  };

  // Download all envelope documents as ZIP
  const handleDownloadEnvelopeAll = async (doc: Document) => {
    if (!doc.isEnvelope || !doc.envelopeDocuments || doc.envelopeDocuments.length === 0) {
      // Fallback to single document download
      handleDownloadDocument(doc.id);
      return;
    }

    try {
      toast({
        title: "Preparando download...",
        description: `Baixando ${doc.envelopeDocuments.length} documentos...`,
      });

      const zip = new JSZip();

      for (const envDoc of doc.envelopeDocuments) {
        // Determine file path (signed or original)
        let filePath: string | null = null;
        
        if (envDoc.bry_signed_file_url) {
          filePath = envDoc.bry_signed_file_url;
        } else if (envDoc.file_url) {
          const urlParts = envDoc.file_url.split('/storage/v1/object/public/documents/');
          if (urlParts.length >= 2) {
            filePath = urlParts[1];
          }
        }

        if (!filePath) continue;

        // Get signed URL
        const { data: signedData, error: signedError } = await supabase
          .storage
          .from('documents')
          .createSignedUrl(filePath, 3600);

        if (signedError || !signedData?.signedUrl) continue;

        // Fetch file
        const response = await fetch(signedData.signedUrl);
        const blob = await response.blob();

        // Add to ZIP with cleaned name
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
  return <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl overflow-hidden">
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
            const prescriptionBg = isPrescription(doc) ? 'bg-purple-50' : '';
            return <TableRow key={doc.id} draggable onDragStart={e => handleDragStart(e, doc.id)} onDragEnd={handleDragEnd} className={`border-none ${prescriptionBg || (index % 2 === 0 ? 'bg-white' : 'bg-gray-100')} hover:opacity-80`}>
                  <TableCell>
                    <div 
                      className={`flex items-center gap-2 ${doc.isEnvelope ? 'cursor-pointer hover:opacity-70' : ''}`}
                      onClick={() => doc.isEnvelope && handleOpenEnvelopeDialog(doc)}
                    >
                      {doc.isEnvelope ? (
                        <FolderOpen className="w-5 h-5 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                      ) : (
                        <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
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
                        {/* Patient name for prescriptions */}
                        {isPrescription(doc) && doc.patientName && (
                          <p className="text-xs text-gray-500">Paciente: {doc.patientName}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">{doc.createdAt}</p>
                          {/* For prescriptions, show prescription doc type instead of signature mode */}
                          {isPrescription(doc) && doc.prescriptionDocType ? (
                            <Badge variant="outline" className="bg-transparent border border-pink-500 text-pink-500 text-[10px] px-1.5 py-0">
                              {prescriptionDocTypeLabels[doc.prescriptionDocType] || doc.prescriptionDocType}
                            </Badge>
                          ) : doc.signatureMode && signatureModeConfig[doc.signatureMode] ? (
                            <Badge variant="outline" className={`${signatureModeConfig[doc.signatureMode].className} text-[10px] px-1.5 py-0`}>
                              {signatureModeConfig[doc.signatureMode].label}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Hide signer badges for prescriptions */}
                    {!isPrescription(doc) && (
                    <TooltipProvider>
                      <div className="flex items-center gap-1">
                        {doc.signerNames?.map((name, idx) => {
                          const status = doc.signerStatuses?.[idx] || 'pending';
                          const email = doc.signerEmails?.[idx] || '';
                          const phone = doc.signerPhones?.[idx] || '';
                          const bgColor = status === 'signed' ? 'bg-blue-700' : status === 'rejected' ? 'bg-red-700' : 'bg-gray-400';
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
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 flex items-center justify-center">
                          <svg className="w-10 h-10 transform -rotate-90 absolute inset-0">
                            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-200" />
                            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray={`${2 * Math.PI * 16}`} strokeDashoffset={`${2 * Math.PI * 16 * (1 - progressPercentage / 100)}`} className={doc.status === "expired" ? "text-red-700" : "text-blue-700"} strokeLinecap="round" style={{
                          transition: 'stroke-dashoffset 1s ease-in-out'
                        }} />
                          </svg>
                          <span className={`text-[10px] font-bold relative z-10 ${doc.signedBy === doc.signers ? "text-green-700" : "text-blue-700"}`}>
                            {doc.signedBy}/{doc.signers}
                          </span>
                        </div>
                      </div>
                      {showFolderActions && folders && folders.length > 0 && (
                        <Popover 
                          open={openFolderPopovers[doc.id] || false} 
                          onOpenChange={(open) => setOpenFolderPopovers(prev => ({ ...prev, [doc.id]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              className="w-[180px] justify-between bg-gray-200/50 backdrop-blur-sm border-none hover:bg-gray-200/70 text-gray-700 hover:text-gray-700"
                            >
                              <span className="flex items-center gap-2">
                                <Folder className="w-4 h-4" />
                                Selecionar pasta
                              </span>
                              <ChevronDown className="w-4 h-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-1 bg-gray-200/70 backdrop-blur-sm border-none z-50">
                            {hierarchicalFolders.map(({ folder, level, hasChildren }) => (
                              <div 
                                key={folder.id}
                                className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 rounded hover:bg-gray-300/50"
                                style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
                              >
                                {hasChildren ? (
                                  <span 
                                    onClick={(e) => toggleFolderExpansion(folder.id, e)}
                                    className="cursor-pointer hover:bg-gray-400/30 rounded p-0.5"
                                  >
                                    {expandedFolders.has(folder.id) ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                  </span>
                                ) : (
                                  <span className="w-4" />
                                )}
                                {level > 0 && <span className="text-gray-400 mr-1">└─</span>}
                                <span className="flex-1 cursor-default">{folder.name}</span>
                                <span 
                                  onClick={() => handleFolderSelect(doc.id, folder.id)}
                                  className="cursor-pointer hover:bg-gray-400/30 rounded p-0.5"
                                  title="Mover para esta pasta"
                                >
                                  <Check className="w-3 h-3 text-gray-500" />
                                </span>
                              </div>
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 justify-end">
                      {doc.signerStatuses?.[0] === "pending" && !isPrescription(doc) && (
                        <Button 
                          variant="ghost"
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => handleSignDocument(doc.id, doc.name)}
                          title="Assinar documento"
                        >
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
                        onClick={() => doc.isEnvelope ? handleDownloadEnvelopeAll(doc) : handleDownloadDocument(doc.id)} 
                        title={doc.isEnvelope ? "Baixar todos os documentos (ZIP)" : "Baixar documento original"}
                      >
                        <Download className="w-4 h-4 text-gray-500" />
                      </Button>
                      {!doc.bryEnvelopeUuid && doc.signatureMode === 'SIMPLE' && doc.signedBy > 0 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => handleDownloadCertificatePDF(doc.id)}
                          title="Baixar certificado de validação (PDF)"
                          disabled={downloadingCertificateId === doc.id}
                        >
                          {downloadingCertificateId === doc.id ? (
                            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                          ) : (
                            <FileDown className="w-4 h-4 text-gray-500" />
                          )}
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
                </TableRow>;
          })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4 rounded-xl overflow-hidden">
        {documents.map(doc => {
        const statusInfo = statusConfig[doc.status];
        const prescriptionBg = isPrescription(doc) ? 'bg-purple-100' : 'bg-gray-100';
        return <div key={doc.id} className={`${prescriptionBg} rounded-lg p-4 space-y-3`} draggable onDragStart={e => handleDragStart(e, doc.id)} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
                {/* Date and Action Buttons on same line - ABOVE document name */}
                <div className="flex items-center justify-between">
                  <p className="text-gray-500 text-sm">{doc.createdAt}</p>
                  <div className="flex gap-1">
                    {doc.signerStatuses?.[0] === "pending" && !isPrescription(doc) && (
                      <Button 
                        variant="ghost"
                        size="icon" 
                        className="rounded-full hover:bg-transparent h-8 w-8" 
                        onClick={() => handleSignDocument(doc.id, doc.name)}
                        title="Assinar documento"
                      >
                        <PenTool className="w-4 h-4 text-gray-500" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full hover:bg-transparent h-8 w-8" 
                      onClick={() => doc.isEnvelope ? handleViewEnvelopeDocuments(doc) : handleViewDocument(doc.id)} 
                      title={doc.isEnvelope ? "Ver documentos do envelope" : "Visualizar documento"}
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full hover:bg-transparent h-8 w-8" 
                      onClick={() => doc.isEnvelope ? handleDownloadEnvelopeAll(doc) : handleDownloadDocument(doc.id)} 
                      title={doc.isEnvelope ? "Baixar todos os documentos (ZIP)" : "Baixar documento original"}
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </Button>
                    {!doc.bryEnvelopeUuid && doc.signatureMode === 'SIMPLE' && doc.signedBy > 0 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-transparent h-8 w-8" 
                        onClick={() => handleDownloadCertificatePDF(doc.id)}
                        title="Baixar certificado de validação (PDF)"
                        disabled={downloadingCertificateId === doc.id}
                      >
                        {downloadingCertificateId === doc.id ? (
                          <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                        ) : (
                          <FileDown className="w-4 h-4 text-gray-500" />
                        )}
                      </Button>
                    )}
                    {doc.bryEnvelopeUuid && doc.signedBy > 0 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-transparent h-8 w-8" 
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
                        className="rounded-full hover:bg-transparent h-8 w-8" 
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
                        className="rounded-full hover:bg-transparent h-8 w-8" 
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
                        className="rounded-full hover:bg-transparent h-8 w-8" 
                        onClick={() => handleResendNotifications(doc.id)}
                        title="Reenviar e-mail e WhatsApp para signatários pendentes"
                      >
                        <Mail className="w-4 h-4 text-gray-500" />
                      </Button>
                    )}
                    {doc.signedBy === 0 && (
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent h-8 w-8" onClick={() => handleDeleteDocument(doc.id, doc.signedBy)} title="Excluir documento">
                        <Trash2 className="w-4 h-4 text-gray-500" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Document Name */}
                <div 
                  className={`space-y-2 ${doc.isEnvelope ? 'cursor-pointer' : ''}`}
                  onClick={() => doc.isEnvelope && handleOpenEnvelopeDialog(doc)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc.isEnvelope ? (
                      <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                    )}
                    <p className="font-medium">{doc.name}</p>
                    {doc.isEnvelope && doc.documentCount && doc.documentCount > 1 && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                        {doc.documentCount} docs
                      </span>
                    )}
                  </div>
                  {/* Patient name for prescriptions */}
                  {isPrescription(doc) && doc.patientName && (
                    <p className="text-xs text-gray-500">Paciente: {doc.patientName}</p>
                  )}
                  {/* For prescriptions, show prescription doc type instead of signature mode */}
                  {isPrescription(doc) && doc.prescriptionDocType ? (
                    <Badge variant="outline" className="bg-transparent border border-pink-500 text-pink-500 text-[10px] px-1.5 py-0 w-fit">
                      {prescriptionDocTypeLabels[doc.prescriptionDocType] || doc.prescriptionDocType}
                    </Badge>
                  ) : doc.signatureMode && signatureModeConfig[doc.signatureMode] ? (
                    <Badge variant="outline" className={`${signatureModeConfig[doc.signatureMode].className} text-[10px] px-1.5 py-0 w-fit`}>
                      {signatureModeConfig[doc.signatureMode].label}
                    </Badge>
                  ) : null}
                  
                  {/* Signer Badges below document name - hide for prescriptions */}
                  {showProgress && doc.signerStatuses && doc.signerStatuses.length > 0 && !isPrescription(doc) && (
                    <TooltipProvider>
                      <div className="flex gap-1 justify-end">
                        {doc.signerStatuses?.map((status, idx) => {
                          const name = doc.signerNames?.[idx] || '';
                          const email = doc.signerEmails?.[idx] || '';
                          const phone = doc.signerPhones?.[idx] || '';
                          return (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white transition-all duration-300 ease-in-out hover:scale-110 ${status === "signed" ? "bg-blue-700" : status === "pending" ? "bg-gray-400" : "bg-red-700"}`}>
                                  {name ? getInitials(name) : idx + 1}
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
                  )}
                </div>
              </div>
              
              {/* Folder selection */}
              {showFolderActions && folders && folders.length > 0 && (
                <div className="pt-2">
                  <Popover 
                    open={openFolderPopovers[`mobile-${doc.id}`] || false} 
                    onOpenChange={(open) => setOpenFolderPopovers(prev => ({ ...prev, [`mobile-${doc.id}`]: open }))}
                  >
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-between bg-gray-200/50 backdrop-blur-sm border-none hover:bg-gray-200/70 text-gray-700 hover:text-gray-700"
                      >
                        <span className="flex items-center gap-2">
                          <Folder className="w-4 h-4" />
                          Selecionar pasta
                        </span>
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-1 bg-gray-200/70 backdrop-blur-sm border-none z-50">
                      {hierarchicalFolders.map(({ folder, level, hasChildren }) => (
                        <div 
                          key={folder.id}
                          className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 rounded hover:bg-gray-300/50"
                          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
                        >
                          {hasChildren ? (
                            <span 
                              onClick={(e) => toggleFolderExpansion(folder.id, e)}
                              className="cursor-pointer hover:bg-gray-400/30 rounded p-0.5"
                            >
                              {expandedFolders.has(folder.id) ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </span>
                          ) : (
                            <span className="w-4" />
                          )}
                          {level > 0 && <span className="text-gray-400 mr-1">└─</span>}
                          <span className="flex-1 cursor-default">{folder.name}</span>
                          <span 
                            onClick={() => {
                              handleFolderSelect(doc.id, folder.id);
                              setOpenFolderPopovers(prev => ({ ...prev, [`mobile-${doc.id}`]: false }));
                            }}
                            className="cursor-pointer hover:bg-gray-400/30 rounded p-0.5"
                            title="Mover para esta pasta"
                          >
                            <Check className="w-3 h-3 text-gray-500" />
                          </span>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>;
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
    </>;
};