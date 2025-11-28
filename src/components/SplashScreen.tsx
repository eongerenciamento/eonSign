import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

interface SplashScreenProps {
  onFinished: () => void;
}

export const SplashScreen = ({ onFinished }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onFinished, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center 
        bg-gradient-to-b from-[#273d60] to-[#001a4d] transition-opacity duration-500
        ${isVisible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="animate-scale-in mb-6">
        <img src={logo} alt="Éon Sign" className="w-24 h-24 rounded-2xl shadow-2xl" />
      </div>

      <h1 
        className="text-white text-3xl font-bold animate-fade-in" 
        style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
      >
        Éon Sign
      </h1>

      <p 
        className="text-gray-300 text-sm mt-2 px-4 text-center animate-fade-in" 
        style={{ animationDelay: "0.5s", animationFillMode: "backwards" }}
      >
        Sistema de Gestão de Documentos e Assinatura Digital
      </p>

      <div className="flex gap-2 mt-8">
        <div 
          className="w-2 h-2 bg-white/60 rounded-full animate-bounce" 
          style={{ animationDelay: "0s" }} 
        />
        <div 
          className="w-2 h-2 bg-white/60 rounded-full animate-bounce" 
          style={{ animationDelay: "0.2s" }} 
        />
        <div 
          className="w-2 h-2 bg-white/60 rounded-full animate-bounce" 
          style={{ animationDelay: "0.4s" }} 
        />
      </div>
    </div>
  );
};
