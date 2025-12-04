import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface CertificatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  documentName: string;
  onDownload: () => void;
}

export const CertificatePreviewDialog = ({
  open,
  onOpenChange,
  pdfUrl,
  documentName,
  onDownload,
}: CertificatePreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">
            Página de Validação - {documentName}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={onDownload}
              className="bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden bg-gray-100">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="Preview do Certificado"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Carregando preview...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
