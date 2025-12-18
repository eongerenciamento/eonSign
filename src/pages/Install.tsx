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
  return (
    <div className="light" style={{ colorScheme: 'light' }}>
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, #273d60, #001a4d)' }}>
        <button onClick={() => navigate("/auth")} className="absolute top-8 left-8" aria-label="Voltar">
          <ArrowLeft className="h-6 w-6" style={{ color: '#f8fafc' }} />
        </button>
        <Card className="w-full max-w-md animate-fade-in rounded-2xl border-0 shadow-xl" style={{ backgroundColor: '#ffffff' }}>
          <CardHeader className="text-center rounded-t-2xl" style={{ backgroundColor: '#ffffff' }}>
            <div className="flex justify-center mb-4">
              <img alt="eonSign" className="h-20 w-20 rounded-2xl shadow-lg" src="/lovable-uploads/35e8816b-11ae-40a9-acbb-c1f64eb8ee31.png" />
            </div>
            <CardTitle className="text-2xl" style={{ color: '#374151' }}>Instalar eonSign</CardTitle>
            <CardDescription style={{ color: '#6b7280' }}>Instale nosso app para uma melhor experiência</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 rounded-b-2xl" style={{ backgroundColor: '#ffffff' }}>
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: '#f3f4f6' }}>
              <Smartphone className="h-5 w-5 mt-0.5" style={{ color: '#4b5563' }} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#374151' }}>Acesso Rápido</h3>
                <p className="text-sm" style={{ color: '#6b7280' }}>Adicione à tela inicial para acesso instantâneo</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: '#f3f4f6' }}>
              <Download className="h-5 w-5 mt-0.5" style={{ color: '#4b5563' }} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#374151' }}>Funciona Offline</h3>
                <p className="text-sm" style={{ color: '#6b7280' }}>Acesse seus documentos mesmo sem internet</p>
              </div>
            </div>

            {isInstallable ? (
              <Button onClick={handleInstall} className="w-full rounded-full" style={{ background: 'linear-gradient(to right, #273d60, #001a4d)', color: '#ffffff' }}>
                Instalar Agora
              </Button>
            ) : (
              <div className="text-center text-sm space-y-2" style={{ color: '#6b7280' }}>
                <p className="font-medium" style={{ color: '#4b5563' }}>Para instalar em dispositivos móveis:</p>
                <p className="font-medium" style={{ color: '#4b5563' }}>
                  iPhone: Toque em <span style={{ color: '#2563eb' }}>Compartilhar</span> →
                  <span style={{ color: '#2563eb' }}> Adicionar à Tela de Início</span>
                </p>
                <p className="font-medium" style={{ color: '#4b5563' }}>
                  Android: Toque no menu →<span style={{ color: '#2563eb' }}> Instalar app</span> ou
                  <span style={{ color: '#2563eb' }}> Adicionar à tela inicial</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default Install;