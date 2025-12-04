import { useState } from "react";
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
    className: "bg-gray-500 text-white"
  },
  ADVANCED: {
    label: "Avançada",
    className: "bg-blue-600 text-white"
  },
  QUALIFIED: {
    label: "ICP-Brasil",
    className: "bg-purple-600 text-white"
  }
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
    try {
      toast({
        title: "Gerando certificado...",
        description: "Obtendo dados do documento.",
      });

      const { data: result, error } = await supabase.functions.invoke(
        "get-document-validation",
        { body: { documentId } }
      );

      if (error || result.error) {
        throw new Error(result?.error || error?.message || 'Erro ao obter dados');
      }

      const { document, organization, signers } = result;
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      // Header background
      pdf.setFillColor(39, 61, 96);
      pdf.rect(0, 0, pageWidth, 45, 'F');

      // Header text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("CERTIFICADO DE VALIDAÇÃO", pageWidth / 2, 20, { align: "center" });
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Eon Sign - Assinatura Eletrônica", pageWidth / 2, 30, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.text(`Emitido por: ${organization.name}`, pageWidth / 2, 38, { align: "center" });

      yPos = 55;

      // Status section
      pdf.setTextColor(0, 0, 0);
      const statusColor = result.valid ? [34, 197, 94] : [234, 179, 8];
      pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(result.valid ? "✓ DOCUMENTO VÁLIDO" : "⏳ DOCUMENTO PENDENTE", pageWidth / 2, yPos + 10, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const statusText = result.valid 
        ? "Este documento foi assinado por todos os signatários e possui validade jurídica."
        : `Aguardando ${document.totalSigners - document.signedCount} assinatura(s).`;
      pdf.text(statusText, pageWidth / 2, yPos + 18, { align: "center" });

      yPos += 35;

      // Document Info Section
      pdf.setTextColor(39, 61, 96);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("INFORMAÇÕES DO DOCUMENTO", margin, yPos);
      
      yPos += 8;
      pdf.setDrawColor(39, 61, 96);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      
      yPos += 10;
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
      };

      const getSignatureModeLabel = (mode: string) => {
        switch (mode) {
          case "SIMPLE": return "Assinatura Simples";
          case "ADVANCED": return "Assinatura Avançada";
          case "QUALIFIED": return "Assinatura Qualificada";
          default: return "Assinatura Eletrônica";
        }
      };

      const docInfo = [
        ["Nome do Documento:", document.name],
        ["Tipo de Assinatura:", getSignatureModeLabel(document.signatureMode)],
        ["Data de Criação:", formatDate(document.createdAt)],
        ["Data de Conclusão:", document.completedAt ? formatDate(document.completedAt) : "Pendente"],
        ["ID do Documento:", document.id],
      ];

      docInfo.forEach(([label, value]) => {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(60, 60, 60);
        pdf.text(label, margin, yPos);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(value, margin + 45, yPos);
        yPos += 7;
      });

      yPos += 10;

      // Signers Section
      pdf.setTextColor(39, 61, 96);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(`SIGNATÁRIOS (${document.signedCount}/${document.totalSigners})`, margin, yPos);
      
      yPos += 8;
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      signers.forEach((signer: any) => {
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }

        const boxHeight = signer.status === "signed" ? 35 : 15;
        pdf.setFillColor(245, 245, 245);
        pdf.roundedRect(margin, yPos - 5, pageWidth - margin * 2, boxHeight, 2, 2, 'F');

        if (signer.status === "signed") {
          pdf.setFillColor(34, 197, 94);
        } else {
          pdf.setFillColor(156, 163, 175);
        }
        pdf.circle(margin + 5, yPos + 3, 3, 'F');

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(signer.name, margin + 12, yPos + 5);
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        const statusLabel = signer.status === "signed" ? "Assinado" : "Pendente";
        pdf.setTextColor(signer.status === "signed" ? 34 : 156, signer.status === "signed" ? 197 : 163, signer.status === "signed" ? 94 : 175);
        pdf.text(`[${statusLabel}]`, margin + 12 + pdf.getTextWidth(signer.name) + 3, yPos + 5);

        if (signer.status === "signed") {
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(9);
          
          let infoY = yPos + 12;
          
          if (signer.signed_at) {
            pdf.text(`Data: ${formatDate(signer.signed_at)}`, margin + 12, infoY);
            infoY += 6;
          }
          
          const location = [signer.signature_city, signer.signature_state].filter(Boolean).join(", ");
          if (location) {
            pdf.text(`Local: ${location}${signer.signature_country ? ` - ${signer.signature_country}` : ""}`, margin + 12, infoY);
            infoY += 6;
          }
          
          if (signer.cpf) {
            pdf.text(`CPF: ${signer.cpf}`, margin + 12, infoY);
            infoY += 6;
          }
          
          if (signer.signature_ip) {
            pdf.text(`IP: ${signer.signature_ip}`, margin + 12, infoY);
          }
        }

        yPos += boxHeight + 5;
      });

      // Footer
      yPos = Math.max(yPos + 10, 260);
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      
      yPos += 8;
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text("Este documento possui validade jurídica conforme Lei n. 14.063/2020 e MP 2.200-2/2001", pageWidth / 2, yPos, { align: "center" });
      pdf.text(`Verificado pelo sistema Eon Sign em ${formatDate(new Date().toISOString())}`, pageWidth / 2, yPos + 5, { align: "center" });
      pdf.text(`URL de Validação: ${window.location.origin}/validar/${documentId}`, pageWidth / 2, yPos + 10, { align: "center" });

      pdf.save(`${document.name}_certificado_validacao.pdf`);
      toast({
        title: "Certificado baixado",
        description: "Certificado de validação baixado com sucesso.",
      });
    } catch (error: any) {
      console.error("Error downloading certificate:", error);
      toast({
        title: "Erro ao baixar certificado",
        description: error.message || "Não foi possível gerar o certificado.",
        variant: "destructive",
      });
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
            return <TableRow key={doc.id} draggable onDragStart={e => handleDragStart(e, doc.id)} onDragEnd={handleDragEnd} className={`border-none ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:opacity-80`}>
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
                        <span className={doc.signedBy === doc.signers ? "text-green-700 font-medium" : "font-medium"}>
                          {doc.signedBy}/{doc.signers}
                        </span>
                        <div className="relative w-10 h-10">
                          <svg className="w-10 h-10 transform -rotate-90">
                            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-200" />
                            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray={`${2 * Math.PI * 16}`} strokeDashoffset={`${2 * Math.PI * 16 * (1 - progressPercentage / 100)}`} className={doc.status === "expired" ? "text-red-700" : "text-green-700"} strokeLinecap="round" style={{
                          transition: 'stroke-dashoffset 1s ease-in-out'
                        }} />
                          </svg>
                        </div>
                      </div>
                      {showFolderActions && folders && folders.length > 0 && <Select value={doc.folderId || ""} onValueChange={value => handleMoveToFolder(doc.id, value)}>
                          <SelectTrigger className="w-[180px] hover:bg-gray-50">
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
                        </Select>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 justify-end">
                      {doc.signerStatuses?.[0] === "pending" && (
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
                        >
                          <FileDown className="w-4 h-4 text-gray-500" />
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
      <div className="md:hidden space-y-4">
        {documents.map(doc => {
        const statusInfo = statusConfig[doc.status];
        return <div key={doc.id} className="bg-gray-100 rounded-lg p-4 space-y-3" draggable onDragStart={e => handleDragStart(e, doc.id)} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
                {/* Date and Action Buttons on same line - ABOVE document name */}
                <div className="flex items-center justify-between">
                  <p className="text-gray-500 text-sm">{doc.createdAt}</p>
                  <div className="flex gap-1">
                    {doc.signerStatuses?.[0] === "pending" && (
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
                      >
                        <FileDown className="w-4 h-4 text-gray-500" />
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
                      <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                    <p className="font-medium">{doc.name}</p>
                    {doc.isEnvelope && doc.documentCount && doc.documentCount > 1 && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                        {doc.documentCount} docs
                      </span>
                    )}
                  </div>
                  {doc.signatureMode && signatureModeConfig[doc.signatureMode] && (
                    <Badge className={`${signatureModeConfig[doc.signatureMode].className} text-[10px] px-1.5 py-0 w-fit`}>
                      {signatureModeConfig[doc.signatureMode].label}
                    </Badge>
                  )}
                  
                  {/* Signer Badges below document name */}
                  {showProgress && doc.signerStatuses && doc.signerStatuses.length > 0 && (
                    <TooltipProvider>
                      <div className="flex gap-1 justify-end">
                        {doc.signerStatuses?.map((status, idx) => {
                          const name = doc.signerNames?.[idx] || '';
                          const email = doc.signerEmails?.[idx] || '';
                          const phone = doc.signerPhones?.[idx] || '';
                          return (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white transition-all duration-300 ease-in-out hover:scale-110 ${status === "signed" ? "bg-green-700" : status === "pending" ? "bg-yellow-700" : "bg-red-700"}`}>
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