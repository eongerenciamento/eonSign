import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Eye, Download, MoreVertical, Move, FolderX, PenTool, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
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
}

export interface Folder {
  id: string;
  name: string;
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

  const handleSignDocument = (documentId: string) => {
    navigate(`/assinar/${documentId}`);
  };

  const handleViewDocument = async (documentId: string) => {
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

    window.open(data.file_url, "_blank");
  };

  const handleDownloadDocument = async (documentId: string) => {
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

    try {
      const response = await fetch(data.file_url);
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
  return <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-none bg-white hover:bg-white">
              <TableHead>Nome do Documento</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assinaturas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc, index) => {
            const statusInfo = statusConfig[doc.status];
            const progressPercentage = doc.signedBy / doc.signers * 100;
            return <TableRow key={doc.id} draggable onDragStart={e => handleDragStart(e, doc.id)} onDragEnd={handleDragEnd} className={`border-none ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:opacity-80`}>
                  <TableCell>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-gray-600">{doc.name}</span>
                      <div className="flex items-center gap-2 ml-4">
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
                        {doc.signedBy === 0 && (
                          <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={() => handleDeleteDocument(doc.id, doc.signedBy)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                        {showFolderActions && allFolders.length > 0 && <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent">
                                <MoreVertical className="w-4 h-4 text-gray-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white z-50">
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Move className="w-4 h-4 mr-2" />
                                  Mover para
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="bg-white z-50">
                                  {doc.folderId && <DropdownMenuItem onClick={() => handleRemoveFromFolder(doc.id)}>
                                      <FolderX className="w-4 h-4 mr-2" />
                                      Remover da pasta
                                    </DropdownMenuItem>}
                                  {allFolders.map(folder => <DropdownMenuItem key={folder.id} onClick={() => handleMoveToFolder(doc.id, folder.id)}>
                                      📁 {folder.name}
                                    </DropdownMenuItem>)}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </DropdownMenuContent>
                          </DropdownMenu>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500">{doc.createdAt}</TableCell>
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
                            {folders.map(folder => <SelectItem key={folder.id} value={folder.id} className="hover:bg-gray-50 focus:bg-gray-50 text-gray-700">
                                {folder.name}
                              </SelectItem>)}
                          </SelectContent>
                        </Select>}
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
                  {doc.signedBy === 0 && (
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent h-8 w-8" onClick={() => handleDeleteDocument(doc.id, doc.signedBy)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
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
                      {folders.map(folder => <SelectItem key={folder.id} value={folder.id} className="hover:bg-gray-50 focus:bg-gray-50 text-gray-700">
                          {folder.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>}
                {showFolderActions && allFolders.length > 0 && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-white z-50">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Move className="w-4 h-4 mr-2" />
                          Mover para
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-white z-50">
                          {doc.folderId && <DropdownMenuItem onClick={() => handleRemoveFromFolder(doc.id)}>
                              <FolderX className="w-4 h-4 mr-2" />
                              Remover da pasta
                            </DropdownMenuItem>}
                          {allFolders.map(folder => <DropdownMenuItem key={folder.id} onClick={() => handleMoveToFolder(doc.id, folder.id)}>
                              📁 {folder.name}
                            </DropdownMenuItem>)}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>}
              </div>
            </div>;
      })}
      </div>
    </>;
};