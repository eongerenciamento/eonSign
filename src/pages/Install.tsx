import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, ArrowLeft } from "lucide-react";
import appIcon from "@/assets/app-icon.png";
const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const {
      outcome
    } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };
  return <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#273d60] to-[#001a4d]">
      <button onClick={() => navigate("/auth")} className="absolute top-8 left-8 text-gray-400" aria-label="Voltar">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={appIcon} alt="Éon Sign" className="h-20 w-20 rounded-2xl shadow-lg" />
          </div>
          <CardTitle className="text-2xl">Instalar Eon Sign</CardTitle>
          <CardDescription>
            Instale nosso app para uma melhor experiência
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <Smartphone className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Acesso Rápido</h3>
              <p className="text-sm text-muted-foreground">
                Adicione à tela inicial para acesso instantâneo
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <Download className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Funciona Offline</h3>
              <p className="text-sm text-muted-foreground">
                Acesse seus documentos mesmo sem internet
              </p>
            </div>
          </div>

          {isInstallable ? <Button onClick={handleInstall} className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white">
              Instalar Agora
            </Button> : <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>Para instalar em dispositivos móveis:</p>
              <p className="font-medium">
                iPhone: Toque em <span className="text-primary">Compartilhar</span> → 
                <span className="text-primary"> Adicionar à Tela de Início</span>
              </p>
              <p className="font-medium">
                Android: Toque no menu → 
                <span className="text-primary"> Instalar app</span> ou 
                <span className="text-primary"> Adicionar à tela inicial</span>
              </p>
            </div>}
        </CardContent>
      </Card>
    </div>;
};
export default Install;