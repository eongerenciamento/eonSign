import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessMessageProps {
  onLoginClick: () => void;
}

export function SuccessMessage({ onLoginClick }: SuccessMessageProps) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="rounded-full bg-green-100 p-3">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-800">Conta criada com sucesso!</h2>
        <p className="text-gray-600">
          Enviamos sua senha temporária para o e-mail informado.
          <br />
          Verifique sua caixa de entrada.
        </p>
      </div>

      <Button
        onClick={onLoginClick}
        className="w-full bg-[#273D60] hover:bg-[#1a2847] text-white"
      >
        Fazer Login
      </Button>
    </div>
  );
}
