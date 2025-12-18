import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Download, FileText, FolderDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface EnvelopeDocument {
  id: string;
  name: string;
  file_url: string | null;
  status: string;
  signed_by: number;
  signers: number;
  bry_signed_file_url?: string | null;
  bry_envelope_uuid?: string | null;
}

interface EnvelopeDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelopeTitle: string;
  documents: EnvelopeDocument[];
}

export const EnvelopeDocumentsDialog = ({
  open,
  onOpenChange,
  envelopeTitle,
  documents,
}: EnvelopeDocumentsDialogProps) => {
  const { toast } = useToast();
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const getFilePath = (doc: EnvelopeDocument): string | null => {
    if (doc.bry_envelope_uuid && doc.status === 'signed' && doc.bry_signed_file_url) {
      return doc.bry_signed_file_url;
    } else if (doc.file_url) {
      const urlParts = doc.file_url.split('/storage/v1/object/public/documents/');
      if (urlParts.length >= 2) {
        return urlParts[1];
      }
    }
    return null;
  };

  const handleViewDocument = async (doc: EnvelopeDocument) => {
    const filePath = getFilePath(doc);
    
    if (!filePath) {
      toast({
        title: "Erro ao visualizar documento",
        description: "URL do documento não encontrada.",
        variant: "destructive",
      });
      return;
    }

    const { data: signedData, error: signedError } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

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

  const handleDownloadDocument = async (doc: EnvelopeDocument) => {
    const filePath = getFilePath(doc);
    let downloadFileName = doc.name;

    if (doc.bry_envelope_uuid && doc.status === 'signed' && doc.bry_signed_file_url) {
      downloadFileName = doc.name.replace('.pdf', '_assinado.pdf');
    }

    if (!filePath) {
      toast({
        title: "Erro ao baixar documento",
        description: "URL do documento não encontrada.",
        variant: "destructive",
      });
      return;
    }

    const { data: signedData, error: signedError } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

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

  const handleDownloadAll = async () => {
    if (documents.length === 0) return;

    setIsDownloadingAll(true);
    toast({
      title: "Preparando download...",
      description: `Baixando ${documents.length} documentos.`,
    });

    try {
      const zip = new JSZip();

      // Download each document and add to ZIP
      for (const doc of documents) {
        const filePath = getFilePath(doc);
        if (!filePath) continue;

        const { data: signedData, error: signedError } = await supabase
          .storage
          .from('documents')
          .createSignedUrl(filePath, 3600);

        if (signedError || !signedData?.signedUrl) continue;

        try {
          const response = await fetch(signedData.signedUrl);
          const blob = await response.blob();
          
          let fileName = doc.name;
          if (doc.bry_envelope_uuid && doc.status === 'signed' && doc.bry_signed_file_url) {
            fileName = doc.name.replace('.pdf', '_assinado.pdf');
          }
          
          zip.file(fileName, blob);
        } catch (err) {
          console.error(`Error downloading ${doc.name}:`, err);
        }
      }

      // Generate ZIP and download
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${envelopeTitle.replace(/[^a-zA-Z0-9]/g, '_')}_documentos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download concluído",
        description: "Todos os documentos foram baixados com sucesso.",
      });
    } catch (err) {
      console.error("Error creating ZIP:", err);
      toast({
        title: "Erro ao baixar documentos",
        description: "Não foi possível criar o arquivo ZIP.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Documentos do Envelope</span>
              <span className="text-sm font-normal text-gray-500">({envelopeTitle})</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Download All Button */}
        <Button
          onClick={handleDownloadAll}
          disabled={isDownloadingAll || documents.length === 0}
          className="w-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:from-[#2d4670] hover:to-[#002855]"
        >
          {isDownloadingAll ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Preparando ZIP...
            </>
          ) : (
            <>
              <FolderDown className="w-4 h-4 mr-2" />
              Baixar todos ({documents.length} docs)
            </>
          )}
        </Button>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 truncate">{doc.name}</p>
                </div>
                <div className="relative w-10 h-10 flex items-center justify-center mr-2">
                  <svg className="w-10 h-10 transform -rotate-90 absolute inset-0">
                    <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="none" className="text-gray-200" />
                    <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray={`${2 * Math.PI * 16}`} strokeDashoffset={`${2 * Math.PI * 16 * (1 - (doc.signers > 0 ? doc.signed_by / doc.signers : 0))}`} className="text-blue-700" strokeLinecap="round" style={{
                      transition: 'stroke-dashoffset 1s ease-in-out'
                    }} />
                  </svg>
                  <span className="text-[9px] font-bold relative z-10 text-blue-700">
                    {doc.signed_by}/{doc.signers}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-gray-200"
                  onClick={() => handleViewDocument(doc)}
                  title="Visualizar"
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-gray-200"
                  onClick={() => handleDownloadDocument(doc)}
                  title="Baixar"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
