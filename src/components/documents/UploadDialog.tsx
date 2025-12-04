import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const UploadDialog = () => {
  const navigate = useNavigate();
  return (
    <Button 
      onClick={() => navigate("/novo-documento")} 
      className="bg-gray-200 hover:bg-gray-300 shadow-lg rounded-full w-12 h-12 p-0 md:w-auto md:h-auto md:px-4 md:py-2 md:rounded-full"
    >
      <Upload className="w-5 h-5 md:mr-2 text-gray-600" />
      <span className="hidden md:inline text-gray-600">Documento</span>
    </Button>
  );
};
