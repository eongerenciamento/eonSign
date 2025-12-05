import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Loader2, Shield, Check, X } from "lucide-react";
import { toast } from "sonner";
interface CertificateCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function CertificateCheckoutDialog({
  open,
  onOpenChange
}: CertificateCheckoutDialogProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"PF" | "PJ">("PF");

  // Form fields
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsibleName, setResponsibleName] = useState("");

  // Load user data on mount
  useEffect(() => {
    if (open) {
      loadUserData();
    }
  }, [open]);
  const loadUserData = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data: companySettings
      } = await supabase.from("company_settings").select("*").eq("user_id", user.id).single();
      if (companySettings) {
        setName(companySettings.admin_name || "");
        setCpf(companySettings.admin_cpf || "");
        setEmail(companySettings.admin_email || user.email || "");
        setPhone(companySettings.admin_phone || "");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };
  const formatCpf = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const limited = cleaned.slice(0, 11);
    return limited.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };
  const formatCnpj = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const limited = cleaned.slice(0, 14);
    return limited.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };
  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const limited = cleaned.slice(0, 11);
    if (limited.length <= 2) return `(${limited}`;
    if (limited.length <= 7) return `(${limited.slice(0, 2)})${limited.slice(2)}`;
    return `(${limited.slice(0, 2)})${limited.slice(2, 7)}-${limited.slice(7)}`;
  };
  const formatBirthDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const limited = cleaned.slice(0, 8);
    if (limited.length <= 2) return limited;
    if (limited.length <= 4) return `${limited.slice(0, 2)}/${limited.slice(2)}`;
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`;
  };
  const isFormValid = () => {
    const cpfClean = cpf.replace(/\D/g, "");
    const phoneClean = phone.replace(/\D/g, "");
    const birthClean = birthDate.replace(/\D/g, "");
    const basicValid = name.length >= 3 && cpfClean.length === 11 && email.includes("@") && phoneClean.length >= 10 && birthClean.length === 8;
    if (type === "PJ") {
      const cnpjClean = cnpj.replace(/\D/g, "");
      return basicValid && cnpjClean.length === 14 && responsibleName.length >= 3;
    }
    return basicValid;
  };
  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast.error("Por favor, preencha todos os campos corretamente");
      return;
    }
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("create-certificate-checkout", {
        body: {
          name,
          cpf: cpf.replace(/\D/g, ""),
          email,
          phone: phone.replace(/\D/g, ""),
          birthDate: birthDate.split("/").reverse().join("-"),
          type,
          cnpj: type === "PJ" ? cnpj.replace(/\D/g, "") : null,
          responsibleName: type === "PJ" ? responsibleName : null
        }
      });
      if (error) throw error;
      if (!data.url) {
        throw new Error("URL de checkout não recebida");
      }

      // Open Stripe checkout in new tab
      window.open(data.url, "_blank");
      onOpenChange(false);
      toast.success("Redirecionando para pagamento...");
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast.error(error.message || "Erro ao criar checkout");
    } finally {
      setLoading(false);
    }
  };
  const resetForm = () => {
    setType("PF");
    setName("");
    setCpf("");
    setEmail("");
    setPhone("");
    setBirthDate("");
    setCnpj("");
    setResponsibleName("");
  };
  return <Dialog open={open} onOpenChange={isOpen => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 [&>button]:text-white [&>button]:hover:text-white/80">
        {/* Header */}
        <div className="bg-[#273d60] p-4 rounded-t-lg flex items-center justify-between border-none">
          <img alt="Eon Sign" className="h-10 w-auto" src="/lovable-uploads/75f16f37-9686-4d42-81df-fbe35fe8735c.png" />
          <h2 className="text-white text-lg font-normal">Certificado Digital A1</h2>
        </div>

        <div className="p-6 border-none">

          {/* Product Card */}
          <div className="bg-gray-100/95 rounded-lg p-4 text-gray-600 border-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span className="font-semibold">Eon Certifica A1</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">R$ 109,90</div>
                <div className="text-xs text-gray-500">pagamento único</div>
              </div>
            </div>
            <ul className="text-sm space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                Certificado ICP-Brasil
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                Validade de 1 ano
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                Emissão 100% online
              </li>
            </ul>
          </div>

          {/* Form */}
          <div className="space-y-4 pt-6">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label>Tipo de Certificado</Label>
              <RadioGroup value={type} onValueChange={v => setType(v as "PF" | "PJ")} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PF" id="pf" />
                  <Label htmlFor="pf" className="cursor-pointer">Pessoa Física</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PJ" id="pj" />
                  <Label htmlFor="pj" className="cursor-pointer">Pessoa Jurídica</Label>
                </div>
              </RadioGroup>
            </div>

            {/* PJ Fields */}
            {type === "PJ" && <>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsibleName">Nome do Responsável</Label>
                  <Input id="responsibleName" placeholder="Nome completo do responsável" value={responsibleName} onChange={e => setResponsibleName(e.target.value)} />
                </div>
              </>}

            {/* Common Fields */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de Nascimento</Label>
              <Input id="birthDate" placeholder="DD/MM/AAAA" value={birthDate} onChange={e => setBirthDate(formatBirthDate(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" placeholder="(00)00000-0000" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button onClick={() => onOpenChange(false)} className="flex-1 gap-2 bg-gray-600 hover:bg-gray-700 text-white">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !isFormValid()} className="flex-1 gap-2 bg-gray-600 hover:bg-gray-700 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pagar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}