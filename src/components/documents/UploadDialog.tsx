import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const UploadDialog = () => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleUpload = () => {
    toast({
      title: "Documento enviado!",
      description: "O documento foi enviado com sucesso e está aguardando assinaturas.",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Novo Documento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Documento para Assinatura</DialogTitle>
          <DialogDescription>
            Faça upload do documento e adicione os signatários para envio
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="document">Documento (PDF)</Label>
            <Input id="document" type="file" accept=".pdf" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Título do Documento</Label>
            <Input id="title" placeholder="Ex: Contrato de Prestação de Serviços" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signers">E-mails dos Signatários</Label>
            <Input id="signers" placeholder="email1@exemplo.com, email2@exemplo.com" />
            <p className="text-xs text-muted-foreground">Separe múltiplos e-mails com vírgula</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleUpload}>Enviar para Assinatura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
