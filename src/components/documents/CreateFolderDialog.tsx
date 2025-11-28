import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateFolderDialogProps {
  onFolderCreated: () => void;
}

export const CreateFolderDialog = ({ onFolderCreated }: CreateFolderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para a pasta.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para criar pastas.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("folders")
      .insert({ name: folderName.trim(), user_id: user.id });

    if (error) {
      toast({
        title: "Erro ao criar pasta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pasta criada",
        description: `A pasta "${folderName}" foi criada com sucesso.`,
      });
      setFolderName("");
      setOpen(false);
      onFolderCreated();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90 rounded-full w-12 h-12 p-0 md:w-auto md:h-auto md:rounded-md md:px-4 md:py-2"
        >
          <FolderPlus className="w-5 h-5 md:mr-2" />
          <span className="hidden md:inline">Nova Pasta</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Nova Pasta</DialogTitle>
          <DialogDescription>
            Crie uma pasta para organizar seus documentos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nome da Pasta</Label>
            <Input
              id="folder-name"
              placeholder="Ex: Contratos 2025"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateFolder} disabled={loading}>
            {loading ? "Criando..." : "Criar Pasta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
