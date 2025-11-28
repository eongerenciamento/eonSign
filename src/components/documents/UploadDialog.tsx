import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const UploadDialog = () => {
  const navigate = useNavigate();

  return (
    <Button className="gap-2" onClick={() => navigate("/novo-documento")}>
      <Upload className="w-4 h-4" />
      Novo Documento
    </Button>
  );
};
