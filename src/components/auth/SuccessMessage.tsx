import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessMessageProps {
  onLoginClick: () => void;
}

export function SuccessMessage({ onLoginClick }: SuccessMessageProps) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-500" strokeWidth={3} />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-700">Conta criada com sucesso!</h2>
        <p className="text-gray-500">
          Enviamos sua senha temporária para o e-mail informado.
        </p>
        <p className="text-sm text-gray-400">Verifique sua caixa de entrada.</p>
      </div>

      <Button
        onClick={onLoginClick}
        className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        Fazer Login
      </Button>
    </div>
  );
}
