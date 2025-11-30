import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SubscriptionGuardProps {
  children: React.ReactNode;
  onLimitReached?: () => void;
}

export function SubscriptionGuard({ children, onLimitReached }: SubscriptionGuardProps) {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{
    canCreate: boolean;
    current: number;
    limit: number;
    planName: string;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkLimit();
  }, []);

  const checkLimit = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-document-limit");
      
      if (error) throw error;
      
      setLimitInfo(data);
      
      if (!data.canCreate) {
        setShowUpgradeDialog(true);
        onLimitReached?.();
      }
    } catch (error) {
      console.error("Error checking document limit:", error);
    }
  };

  const handleUpgrade = () => {
    navigate("/configuracoes?tab=subscription");
  };

  return (
    <>
      {children}
      
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limite de Documentos Atingido</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você atingiu o limite de <strong>{limitInfo?.limit} documentos</strong> do plano{" "}
                <strong>{limitInfo?.planName}</strong> este mês.
              </p>
              <p>Faça upgrade para continuar criando documentos.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpgrade}>Ver Planos</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
