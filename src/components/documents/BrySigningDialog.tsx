import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrySigningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signingUrl: string | null;
  documentName: string;
  onSigningComplete?: () => void;
}

export const BrySigningDialog = ({
  open,
  onOpenChange,
  signingUrl,
  documentName,
  onSigningComplete
}: BrySigningDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [signingStatus, setSigningStatus] = useState<"idle" | "signed" | "error">("idle");

  // Handle messages from BRy iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data === "signed") {
      setSigningStatus("signed");
      toast({
        title: "Documento assinado!",
        description: "Sua assinatura foi registrada com sucesso.",
      });
      
      // Close dialog after short delay and trigger refresh
      setTimeout(() => {
        onOpenChange(false);
        onSigningComplete?.();
      }, 2000);
    }
    
    if (event.data === "error") {
      setSigningStatus("error");
      toast({
        title: "Erro na assinatura",
        description: "Ocorreu um erro ao processar sua assinatura. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [toast, onOpenChange, onSigningComplete]);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setSigningStatus("idle");
      window.addEventListener("message", handleMessage);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [open, handleMessage]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (!signingUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-medium truncate flex-1 pr-4">
            Assinando: {documentName}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="relative flex-1 w-full h-full min-h-0">
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando interface de assinatura...</p>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {signingStatus === "signed" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
              <div className="flex flex-col items-center gap-3">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <p className="text-lg font-medium">Assinatura concluída!</p>
                <p className="text-sm text-muted-foreground">Fechando...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {signingStatus === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
              <div className="flex flex-col items-center gap-3">
                <XCircle className="h-16 w-16 text-red-500" />
                <p className="text-lg font-medium">Erro na assinatura</p>
                <Button onClick={() => setSigningStatus("idle")} variant="outline">
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* BRy signing iframe */}
          <iframe
            src={signingUrl}
            id="brySigningIframe"
            className="w-full h-full border-0"
            style={{ minHeight: "calc(90vh - 60px)" }}
            allow="camera; geolocation"
            onLoad={handleIframeLoad}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
