import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_URL } from "@/constants/assets";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SuccessMessage } from "@/components/auth/SuccessMessage";
type AuthMode = 'login' | 'register' | 'success';
const RadialGlow = () => <motion.div className="absolute inset-0" animate={{
  background: ["radial-gradient(ellipse at 40% 40%, rgba(100, 150, 255, 0.35) 0%, transparent 70%)", "radial-gradient(ellipse at 60% 60%, rgba(100, 150, 255, 0.4) 0%, transparent 70%)", "radial-gradient(ellipse at 50% 45%, rgba(120, 170, 255, 0.35) 0%, transparent 70%)", "radial-gradient(ellipse at 40% 55%, rgba(100, 150, 255, 0.38) 0%, transparent 70%)", "radial-gradient(ellipse at 40% 40%, rgba(100, 150, 255, 0.35) 0%, transparent 70%)"]
}} transition={{
  duration: 8,
  repeat: Infinity,
  ease: "easeInOut"
}} style={{
  filter: "blur(40px)"
}} />;
const PoweredBy = () => <div className="text-center space-y-3">
    <a href="https://certifica.eonhub.com.br" target="_blank" rel="noopener noreferrer" style={{
    backgroundColor: "rgba(255, 255, 255, 0.1)"
  }} className="inline-block px-4 py-2 text-white text-sm transition-all hover:opacity-90 font-normal rounded-full">
      Certificado Digital <span className="text-xs">R$</span>109.90
    </a>
    <div>
      <span className="text-gray-400 text-sm">
        Powered by{" "}
        <a href="https://eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold text-gray-300 hover:text-gray-400 transition-colors">
          eonhub
        </a>
      </span>
    </div>
  </div>;
const PoweredBySimple = () => <div className="text-center">
    <span className="text-gray-400 text-sm font-normal">
      Powered by{" "}
      <a href="https://eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold text-gray-600 hover:text-gray-700 transition-colors">
        eonhub
      </a>
    </span>
  </div>;
export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const getHeaderText = () => {
    switch (mode) {
      case 'register':
        return {
          title: "Criar Conta",
          subtitle: "Comece grátis!"
        };
      case 'success':
        return {
          title: "",
          subtitle: ""
        };
      default:
        return {
          title: "Login",
          subtitle: ""
        };
    }
  };
  const {
    title,
    subtitle
  } = getHeaderText();
  const renderContent = () => {
    switch (mode) {
      case 'register':
        return <RegisterForm onSuccess={() => setMode('success')} onLoginClick={() => setMode('login')} />;
      case 'success':
        return <SuccessMessage onLoginClick={() => setMode('login')} />;
      default:
        return <LoginForm onSuccess={() => navigate("/dashboard")} onRegisterClick={() => setMode('register')} onInstallClick={() => navigate("/install")} />;
    }
  };
  return <div className="light" style={{
    colorScheme: 'light'
  }}>
      {/* Mobile Layout */}
      <div className="md:hidden h-screen flex flex-col overflow-hidden" style={{
      backgroundColor: '#273D60'
    }}>
        <div className="relative flex-shrink-0 px-6 pb-36" style={{
        background: "linear-gradient(to bottom, #273D60, #1a2847)",
        paddingTop: "calc(env(safe-area-inset-top) + 2rem)"
      }}>
          <RadialGlow />
          <div className="relative z-20 flex justify-center pt-32">
            <img src={LOGO_URL} alt="Logo" className="h-20 w-auto" />
          </div>
        </div>

        <div className="flex-1 rounded-t-3xl -mt-4 px-6 py-5 relative z-30 flex flex-col overflow-hidden" style={{
        backgroundColor: '#ffffff'
      }}>
          {mode !== 'success' && <div className="text-center mb-4">
              <h1 style={{
            color: '#4b5563'
          }} className="text-lg font-semibold">
                {title}
              </h1>
            </div>}

          {renderContent()}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-screen p-6" style={{
      backgroundColor: '#ffffff'
    }}>
        <div className="relative w-[40%] flex flex-col items-center justify-center rounded-3xl overflow-hidden" style={{
        background: "linear-gradient(to bottom, #273D60, #0a1525)"
      }}>
          <RadialGlow />
          <div className="relative z-10">
            <img src={LOGO_URL} alt="Logo" className="h-24 w-auto" />
          </div>
          <div className="absolute bottom-8 left-0 right-0 z-10">
            <PoweredBy />
          </div>
        </div>

        <div className="w-[60%] flex flex-col items-center justify-center p-8 rounded-r-3xl relative" style={{
        backgroundColor: '#ffffff'
      }}>
          <div className="w-full max-w-md">
            {mode !== 'success' && <div className="text-center mb-6">
                <h1 style={{
              color: '#4b5563'
            }} className="text-lg font-semibold">
                  {title}
                </h1>
              </div>}

            {renderContent()}
          </div>
          
          {/* Links legais posicionados na mesma altura do Powered by */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 text-xs text-gray-400">
            <a href="/privacidade" className="hover:text-gray-600 transition-colors">Privacidade</a>
            <span>·</span>
            <a href="/termos" className="hover:text-gray-600 transition-colors">Termos</a>
          </div>
        </div>
      </div>
    </div>;
}