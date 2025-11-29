import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const UploadDialog = () => {
  const navigate = useNavigate();

  return (
    <Button 
      className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:from-[#2d4670] hover:to-[#002855] rounded-full w-12 h-12 p-0 md:w-auto md:h-auto md:rounded-md md:px-4 md:py-2" 
      onClick={() => navigate("/novo-documento")}
    >
      <Upload className="w-5 h-5 md:mr-2" />
      <span className="hidden md:inline">Novo Documento</span>
    </Button>
  );
};
