import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Eye, Download, PenTool, Trash2, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
export interface Document {
  id: string;
  name: string;
  createdAt: string;
  status: "pending" | "signed" | "expired" | "in_progress";
  signers: number;
  signedBy: number;
  signerStatuses?: ("signed" | "pending" | "rejected")[];
  signerNames?: string[];
  folderId?: string | null;
  fileUrl?: string | null;
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
  showFolderActions = true
}: DocumentsTableProps) => {
  const {
    toast
  } = useToast();
  const navigate = useNavigate();

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

  const handleSignDocument = async (documentId: string) => {
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
          // Redirecionar para BRy se link existir
          window.open(signerData.bry_signer_link, '_blank');
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

  const handleSyncBryStatus = async (documentId: string) => {
    try {
      toast({
        title: "Sincronizando...",
        description: "Consultando status no BRy.",
      });

      const { data, error } = await supabase.functions.invoke('bry-sync-status', {
        body: { documentId },
      });

      if (error) {
        throw error;
      }

      if (data.completed) {
        toast({
          title: "Documento assinado!",
          description: "Todas as assinaturas foram concluídas.",
        });
      } else {
        toast({
          title: "Status atualizado",
          description: `${data.signedCount}/${data.totalSigners} assinaturas concluídas.`,
        });
      }

      // Recarregar a página para mostrar novo status
      if (onDocumentMoved) {
        onDocumentMoved();
      }
    } catch (error) {
      console.error('Error syncing BRy status:', error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível obter o status do BRy.",
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async (documentId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("documents")
      .select("file_url")
      .eq("id", documentId)
      .single();

    if (error || !data?.file_url) {
      toast({
        title: "Erro ao visualizar documento",
        description: "Não foi possível carregar o documento.",
        variant: "destructive",
      });
      return;
    }

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

    const filePath = urlParts[1];

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
      .select("file_url, name")
      .eq("id", documentId)
      .single();

    if (error || !data?.file_url) {
      toast({
        title: "Erro ao baixar documento",
        description: "Não foi possível carregar o documento.",
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

    const filePath = urlParts[1];

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
      link.download = data.name;
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
        // Send email
        await supabase.functions.invoke('send-signature-email', {
          body: {
            signerEmail: signer.email,
            signerName: signer.name,
            documentName: documentData.name,
            documentId: documentData.id,
            organizationName: companyData.company_name,
          },
        });

        // Send WhatsApp
        await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            signerName: signer.name,
            signerPhone: signer.phone,
            documentName: documentData.name,
            documentId: documentData.id,
            organizationName: companyData.company_name,
            isCompleted: false,
          },
        });
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
                    <div className="space-y-0.5">
                      <span className="font-medium text-gray-600">{doc.name}</span>
                      <p className="text-xs text-gray-500">{doc.createdAt}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
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
                          onClick={() => handleSignDocument(doc.id)}
                        >
                          <PenTool className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleViewDocument(doc.id)}>
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleDownloadDocument(doc.id)}>
                        <Download className="w-4 h-4 text-gray-500" />
                      </Button>
                      {doc.status !== 'signed' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => handleResendNotifications(doc.id)}
                          title="Reenviar notificações"
                        >
                          <Mail className="w-4 h-4 text-blue-500" />
                        </Button>
                      )}
                      {doc.status !== 'signed' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-transparent" 
                          onClick={() => handleSyncBryStatus(doc.id)}
                          title="Sincronizar status BRy"
                        >
                          <RefreshCw className="w-4 h-4 text-green-500" />
                        </Button>
                      )}
                      {doc.signedBy === 0 && (
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleDeleteDocument(doc.id, doc.signedBy)}>
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
                <div className="flex justify-end gap-1">
                  {doc.signerStatuses?.[0] === "pending" && (
                    <Button 
                      variant="ghost"
                      size="icon" 
                      className="rounded-full hover:bg-transparent h-8 w-8" 
                      onClick={() => handleSignDocument(doc.id)}
                    >
                      <PenTool className="w-4 h-4 text-gray-500" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent h-8 w-8" onClick={() => handleViewDocument(doc.id)}>
                    <Eye className="w-4 h-4 text-gray-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent h-8 w-8" onClick={() => handleDownloadDocument(doc.id)}>
                    <Download className="w-4 h-4 text-gray-500" />
                  </Button>
                  {doc.status !== 'signed' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full hover:bg-transparent h-8 w-8" 
                      onClick={() => handleResendNotifications(doc.id)}
                      title="Reenviar notificações"
                    >
                      <Mail className="w-4 h-4 text-blue-500" />
                    </Button>
                  )}
                  {doc.status !== 'signed' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full hover:bg-transparent h-8 w-8" 
                      onClick={() => handleSyncBryStatus(doc.id)}
                      title="Sincronizar status BRy"
                    >
                      <RefreshCw className="w-4 h-4 text-green-500" />
                    </Button>
                  )}
                  {doc.signedBy === 0 && (
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent h-8 w-8" onClick={() => handleDeleteDocument(doc.id, doc.signedBy)}>
                      <Trash2 className="w-4 h-4 text-gray-500" />
                    </Button>
                  )}
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-gray-500 text-sm">{doc.createdAt}</p>
                </div>
              </div>
              
              {showProgress && <div className="space-y-1">
                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${doc.status === "expired" ? "bg-red-500" : "bg-[#273d60]"}`} style={{
                  width: `${doc.signedBy / doc.signers * 100}%`
                }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {doc.signedBy}/{doc.signers}
                      </p>
                      <div className="flex gap-1">
                        {doc.signerStatuses?.map((status, idx) => <div key={idx} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white ${status === "signed" ? "bg-green-700" : status === "pending" ? "bg-yellow-700" : "bg-red-700"}`}>
                            {doc.signerNames?.[idx] ? getInitials(doc.signerNames[idx]) : idx + 1}
                          </div>)}
                      </div>
                    </div>
                  </div>
                </div>}
              
              <div className="flex flex-col gap-3 pt-2">
                {showFolderActions && folders && folders.length > 0 && <Select value={doc.folderId || ""} onValueChange={value => handleMoveToFolder(doc.id, value)}>
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
                  </Select>}
              </div>
            </div>;
      })}
      </div>
    </>;
};