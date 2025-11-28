import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { useEffect, useState, useRef } from "react";
import { Upload } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminCpf, setAdminCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (companyData) {
          setCompanyName(companyData.company_name);
          setCnpj(companyData.cnpj);
          setLogo(companyData.logo_url);
          setCep(companyData.cep);
          setStreet(companyData.street);
          setNeighborhood(companyData.neighborhood);
          setCity(companyData.city);
          setState(companyData.state);
          setAdminName(companyData.admin_name);
          setAdminCpf(companyData.admin_cpf);
          setPhone(companyData.admin_phone);
          setCompanyEmail(companyData.admin_email);
        }
      }
    };

    loadData();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      toast.success("Logout realizado");
      navigate("/auth");
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)})${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)})${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const handleCepChange = async (value: string) => {
    const numbers = value.replace(/\D/g, "");
    setCep(numbers);

    if (numbers.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
        } else {
          toast.error("CEP não encontrado");
        }
      } catch (error) {
        toast.error("Erro ao buscar CEP");
      }
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCompany = async () => {
    if (!user) return;

    if (!companyName || !cnpj || !cep || !street || !neighborhood || !city || !state || !adminName || !adminCpf || !phone || !companyEmail) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    const { data: existingData } = await supabase
      .from('company_settings')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const companyData = {
      user_id: user.id,
      company_name: companyName,
      cnpj,
      logo_url: logo,
      cep,
      street,
      neighborhood,
      city,
      state,
      admin_name: adminName,
      admin_cpf: adminCpf,
      admin_phone: phone,
      admin_email: companyEmail,
    };

    if (existingData) {
      const { error } = await supabase
        .from('company_settings')
        .update(companyData)
        .eq('user_id', user.id);

      if (error) {
        toast.error("Erro ao salvar dados da empresa");
        return;
      }
    } else {
      const { error } = await supabase
        .from('company_settings')
        .insert([companyData]);

      if (error) {
        toast.error("Erro ao salvar dados da empresa");
        return;
      }
    }

    toast.success("Dados da empresa salvos com sucesso!");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-sm font-bold text-gray-600">Configurações</h1>
        </div>

        <Separator />

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company">Empresa</TabsTrigger>
            <TabsTrigger value="subscription">Assinatura</TabsTrigger>
            <TabsTrigger value="support">Suporte</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>Dados cadastrais da empresa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="flex items-center gap-6">
                  <div
                    className="relative w-24 h-24 rounded-full bg-muted border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt="Logo"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <div>
                    <p className="text-sm font-medium">Logo da Empresa</p>
                    <p className="text-xs text-muted-foreground">
                      Clique para fazer upload
                    </p>
                  </div>
                </div>

                {/* Company Data */}
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="company-name">Nome da Empresa</Label>
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Digite o nome da empresa"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                        maxLength={8}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Bairro"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="street">Endereço</Label>
                    <Input
                      id="street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Rua, Avenida..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Cidade"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="UF"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid gap-2">
                    <Label htmlFor="admin-name">Nome do Sócio Administrador</Label>
                    <Input
                      id="admin-name"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Nome completo"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="user-id">ID do Usuário</Label>
                    <Input
                      id="user-id"
                      value={user?.id || ""}
                      disabled
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="admin-cpf">CPF do Sócio Administrador</Label>
                    <Input
                      id="admin-cpf"
                      value={adminCpf}
                      onChange={(e) => setAdminCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="company-phone">Telefone</Label>
                    <Input
                      id="company-phone"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(00)00000-0000"
                      maxLength={14}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="company-email">E-mail</Label>
                    <Input
                      id="company-email"
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="contato@empresa.com"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white border-none hover:opacity-90"
                    onClick={() => {
                      setLogo(null);
                      setCompanyName("");
                      setCnpj("");
                      setCep("");
                      setStreet("");
                      setNeighborhood("");
                      setCity("");
                      setState("");
                      setAdminName("");
                      setAdminCpf("");
                      setPhone("");
                      setCompanyEmail("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90"
                    onClick={handleSaveCompany}
                  >
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Assinatura</CardTitle>
                <CardDescription>Gerenciar sua assinatura do Éon Sign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plano Atual</Label>
                  <Input value="Plano Básico" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Input value="Ativo" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Próxima Cobrança</Label>
                  <Input value="15/01/2025" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input value="R$ 99,00/mês" disabled />
                </div>
                <div className="pt-4">
                  <Button className="w-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90">
                    Gerenciar Assinatura
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Suporte</CardTitle>
                <CardDescription>Central de ajuda e tickets de suporte</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Precisa de ajuda? Entre em contato com nosso suporte ou consulte seus tickets abertos.
                  </p>
                  <div className="grid gap-3">
                    <Button className="w-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90">
                      Abrir Novo Ticket
                    </Button>
                    <Button variant="outline" className="w-full">
                      Ver Meus Tickets
                    </Button>
                    <Button variant="outline" className="w-full">
                      Central de Ajuda
                    </Button>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="space-y-2">
                  <Label>E-mail de Suporte</Label>
                  <Input value="suporte@eonsign.com.br" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Horário de Atendimento</Label>
                  <Input value="Segunda a Sexta, 9h às 18h" disabled />
                </div>

                <div className="pt-4">
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={handleLogout}
                  >
                    Sair do Sistema
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
