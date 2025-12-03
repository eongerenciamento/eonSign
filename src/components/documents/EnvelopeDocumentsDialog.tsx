import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  const handleViewDocument = async (doc: EnvelopeDocument) => {
    let filePath: string;

    if (doc.bry_envelope_uuid && doc.status === 'signed' && doc.bry_signed_file_url) {
      filePath = doc.bry_signed_file_url;
    } else if (doc.file_url) {
      const urlParts = doc.file_url.split('/storage/v1/object/public/documents/');
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
    let filePath: string;
    let downloadFileName = doc.name;

    if (doc.bry_envelope_uuid && doc.status === 'signed' && doc.bry_signed_file_url) {
      filePath = doc.bry_signed_file_url;
      downloadFileName = doc.name.replace('.pdf', '_assinado.pdf');
    } else if (doc.file_url) {
      const urlParts = doc.file_url.split('/storage/v1/object/public/documents/');
      if (urlParts.length < 2) {
        toast({
          title: "Erro ao baixar documento",
          description: "URL do documento inválida.",
          variant: "destructive",
        });
        return;
      }
      filePath = urlParts[1];
    } else {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Documentos do Envelope</span>
            <span className="text-sm font-normal text-gray-500">({envelopeTitle})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500">
                    {doc.signed_by}/{doc.signers} assinaturas
                  </p>
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
