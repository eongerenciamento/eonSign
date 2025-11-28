import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Signer {
  name: string;
  cpf: string;
  phone: string;
  email: string;
}

const NewDocument = () => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [signers, setSigners] = useState<Signer[]>([
    { name: "", cpf: "", phone: "", email: "" },
  ]);
  const [companySigner, setCompanySigner] = useState<Signer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadCompanySigner = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('admin_name, admin_cpf, admin_phone, admin_email')
          .eq('user_id', user.id)
          .single();

        if (companyData) {
          setCompanySigner({
            name: companyData.admin_name,
            cpf: companyData.admin_cpf,
            phone: companyData.admin_phone,
            email: companyData.admin_email,
          });
        }
      }
    };

    loadCompanySigner();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos PDF.",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos PDF.",
          variant: "destructive",
        });
      }
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)})${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)})${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleSignerChange = (
    index: number,
    field: keyof Signer,
    value: string
  ) => {
    const newSigners = [...signers];
    if (field === "phone") {
      newSigners[index][field] = formatPhone(value);
    } else {
      newSigners[index][field] = value;
    }
    setSigners(newSigners);
  };

  const addSigner = () => {
    setSigners([...signers, { name: "", cpf: "", phone: "", email: "" }]);
  };

  const removeSigner = (index: number) => {
    if (signers.length > 1) {
      setSigners(signers.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    if (!file || !title) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o título e selecione um arquivo.",
        variant: "destructive",
      });
      return;
    }

    const hasEmptySigner = signers.some(
      (signer) =>
        !signer.name || !signer.cpf || !signer.phone || !signer.email
    );

    if (hasEmptySigner) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos dos signatários.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Documento enviado!",
      description: "O documento foi enviado com sucesso e está aguardando assinaturas.",
    });
    navigate("/documentos");
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-sm font-bold text-gray-600">Novo Documento</h1>
          <p className="text-xs text-gray-500 mt-1">
            Envie um documento para assinatura digital
          </p>
        </div>

        <div className="space-y-6 bg-card p-6 rounded-lg border">
          {/* Drag and Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {!file ? (
              <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Arraste e solte seu documento aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">ou</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Selecionar Arquivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-4">
                  Apenas arquivos PDF são aceitos
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <FileText className="w-8 h-8 text-primary" />
                <div className="flex-1 text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="title">Título do Documento</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Contrato de Prestação de Serviços"
              />
            </div>

            {/* Signers Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold text-gray-600">Signatários</Label>
              
              {/* Company Signer (Read-only) */}
              {companySigner && (
                <div className="p-4 border rounded-lg space-y-3 bg-primary/5">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Signatário da Empresa</p>
                  <div className="grid gap-2">
                    <Label>Nome Completo</Label>
                    <Input value={companySigner.name} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label>CPF</Label>
                    <Input value={companySigner.cpf} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input value={companySigner.phone} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label>E-mail</Label>
                    <Input value={companySigner.email} disabled />
                  </div>
                </div>
              )}

              <p className="text-sm font-medium text-gray-600">Outros Signatários</p>
              {signers.map((signer, index) => (
                <div key={index} className="relative p-4 border rounded-lg space-y-3 bg-muted/20">
                  {signers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeSigner(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <div className="grid gap-2">
                    <Label htmlFor={`name-${index}`}>Nome Completo</Label>
                    <Input
                      id={`name-${index}`}
                      value={signer.name}
                      onChange={(e) =>
                        handleSignerChange(index, "name", e.target.value)
                      }
                      placeholder="Digite o nome completo"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`cpf-${index}`}>CPF</Label>
                    <Input
                      id={`cpf-${index}`}
                      value={signer.cpf}
                      onChange={(e) =>
                        handleSignerChange(index, "cpf", e.target.value)
                      }
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`phone-${index}`}>Telefone</Label>
                    <Input
                      id={`phone-${index}`}
                      value={signer.phone}
                      onChange={(e) =>
                        handleSignerChange(index, "phone", e.target.value)
                      }
                      placeholder="(00)00000-0000"
                      maxLength={14}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`email-${index}`}>E-mail</Label>
                    <Input
                      id={`email-${index}`}
                      type="email"
                      value={signer.email}
                      onChange={(e) =>
                        handleSignerChange(index, "email", e.target.value)
                      }
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
              ))}
              
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={addSigner}
                  className="w-10 h-10 rounded-full hover:bg-transparent active:bg-transparent focus:bg-transparent"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white border-none hover:opacity-90"
              onClick={() => navigate("/documentos")}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90" 
              onClick={handleSubmit}
            >
              Enviar para Assinatura
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NewDocument;
