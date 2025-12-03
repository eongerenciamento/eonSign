import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
export const UploadDialog = () => {
  const navigate = useNavigate();
  return <Button onClick={() => navigate("/novo-documento")} className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:from-[#2d4670] hover:to-[#002855] rounded-full w-12 h-12 p-0 md:w-auto md:h-auto md:px-4 md:py-2 bg-gray-200 hover:bg-gray-100 md:rounded-full">
      <Upload className="w-5 h-5 md:mr-2" />
      <span className="hidden md:inline">Novo Documento</span>
    </Button>;
};