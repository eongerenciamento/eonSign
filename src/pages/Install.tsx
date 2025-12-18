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
        <ArrowLeft className="h-6 w-6 text-slate-50" />
      </button>
      <Card className="w-full max-w-md animate-fade-in bg-white rounded-2xl border-0 shadow-xl">
        <CardHeader className="text-center bg-white rounded-t-2xl">
          <div className="flex justify-center mb-4">
            <img alt="eonSign" className="h-20 w-20 rounded-2xl shadow-lg" src="/lovable-uploads/35e8816b-11ae-40a9-acbb-c1f64eb8ee31.png" />
          </div>
          <CardTitle className="text-2xl text-gray-700">Instalar eonSign</CardTitle>
          <CardDescription className="text-gray-500">Instale nosso app para uma melhor experiência</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 bg-white rounded-b-2xl">
          <div className="flex items-start gap-3 p-4 bg-gray-100 rounded-lg">
            <Smartphone className="h-5 w-5 mt-0.5 text-gray-600" />
            <div>
              <h3 className="font-semibold mb-1 text-gray-700">Acesso Rápido</h3>
              <p className="text-sm text-gray-500">Adicione à tela inicial para acesso instantâneo</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-gray-100 rounded-lg">
            <Download className="h-5 w-5 mt-0.5 text-gray-600" />
            <div>
              <h3 className="font-semibold mb-1 text-gray-700">Funciona Offline</h3>
              <p className="text-sm text-gray-500">Acesse seus documentos mesmo sem internet</p>
            </div>
          </div>

          {isInstallable ? <Button onClick={handleInstall} className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white rounded-full">
              Instalar Agora
            </Button> : <div className="text-center text-sm text-gray-500 space-y-2">
              <p className="font-medium text-gray-600">Para instalar em dispositivos móveis:</p>
              <p className="font-medium text-gray-600">
                iPhone: Toque em <span className="text-blue-600">Compartilhar</span> →
                <span className="text-blue-600"> Adicionar à Tela de Início</span>
              </p>
              <p className="font-medium text-gray-600">
                Android: Toque no menu →<span className="text-blue-600"> Instalar app</span> ou
                <span className="text-blue-600"> Adicionar à tela inicial</span>
              </p>
            </div>}
        </CardContent>
      </Card>
    </div>;
};
export default Install;