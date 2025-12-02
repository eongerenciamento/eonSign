import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { useEffect, useState, useRef } from "react";
import { Upload, Building2, CreditCard, HelpCircle, X, Check } from "lucide-react";
import { SubscriptionTab } from "@/components/settings/SubscriptionTab";
import { CreateTicketSheet } from "@/components/settings/CreateTicketSheet";
import { useQuery } from "@tanstack/react-query";
const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Get tab from URL params
  const activeTab = searchParams.get('tab') || 'company';

  // Fetch support tickets
  const {
    data: tickets,
    refetch: refetchTickets
  } = useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const {
        data,
        error
      } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, {
      bg: string;
      text: string;
      label: string;
    }> = {
      aberto: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: 'Aberto'
      },
      em_andamento: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: 'Em Andamento'
      },
      resolvido: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: 'Resolvido'
      },
      fechado: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        label: 'Fechado'
      }
    };
    const config = statusConfig[status] || statusConfig.aberto;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>;
  };
  useEffect(() => {
    const loadData = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const {
          data: companyData
        } = await supabase.from('company_settings').select('*').eq('user_id', user.id).single();
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
    const {
      error
    } = await supabase.auth.signOut();
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
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)})${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)})${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };
  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
  };
  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };
  const handleCpfChange = (value: string) => {
    setAdminCpf(formatCPF(value));
  };
  const handleCnpjChange = (value: string) => {
    setCnpj(formatCNPJ(value));
  };
  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = async (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const formatted = formatCEP(value);
    setCep(formatted);
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
    const {
      data: existingData
    } = await supabase.from('company_settings').select('id').eq('user_id', user.id).single();
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
      admin_email: companyEmail
    };
    if (existingData) {
      const {
        error
      } = await supabase.from('company_settings').update(companyData).eq('user_id', user.id);
      if (error) {
        toast.error("Erro ao salvar dados da empresa");
        return;
      }
    } else {
      const {
        error
      } = await supabase.from('company_settings').insert([companyData]);
      if (error) {
        toast.error("Erro ao salvar dados da empresa");
        return;
      }
    }
    toast.success("Dados da empresa salvos com sucesso!");
  };
  return <Layout>
      <div className="p-8 pb-20 space-y-6 w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-gray-600">Configurações</h1>
          <Button 
            className="md:hidden bg-[#283d60] text-white font-light hover:bg-[#283d60]/90 text-xs px-3 py-1 h-auto"
          >
            Certificado A1 R$109.90
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={value => navigate(`/configuracoes?tab=${value}`)} className="w-full mx-auto max-w-6xl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden md:inline">Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden md:inline">Assinatura</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden md:inline">Suporte</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-gray-600 text-base">Informações da Empresa</CardTitle>
                
                {/* Logo Upload */}
                <div className="relative">
                  <div className="relative w-14 h-14 rounded-full bg-muted border-2 border-muted-foreground/25 flex items-center justify-center overflow-hidden">
                    {logo ? (
                      <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Company Data */}
                <div className="grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="company-name">Nome da Empresa</Label>
                      <Input id="company-name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Digite o nome da empresa" className="text-gray-600" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input id="cnpj" value={cnpj} onChange={e => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric" className="text-gray-600" />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="street">Endereço</Label>
                    <Input id="street" value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua, Avenida..." className="text-gray-600" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input id="cep" value={cep} onChange={e => handleCepChange(e.target.value)} placeholder="00.000-000" maxLength={10} inputMode="numeric" className="text-gray-600" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input id="neighborhood" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Bairro" className="text-gray-600" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" className="text-gray-600" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input id="state" value={state} onChange={e => setState(e.target.value)} placeholder="UF" maxLength={2} className="text-gray-600" />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="admin-name">Nome do Sócio Administrador</Label>
                      <Input id="admin-name" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Nome completo" className="text-gray-600" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="user-id">ID do Usuário</Label>
                      <Input id="user-id" value={user?.id || ""} disabled className="text-gray-600" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="admin-cpf">CPF do Sócio Administrador</Label>
                      <Input id="admin-cpf" value={adminCpf} onChange={e => handleCpfChange(e.target.value)} placeholder="000.000.000-00" maxLength={14} inputMode="numeric" className="text-gray-600" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="company-phone">Telefone</Label>
                      <Input id="company-phone" value={phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="(00)00000-0000" maxLength={14} inputMode="tel" className="text-gray-600" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="company-email">E-mail</Label>
                      <Input id="company-email" type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="contato@empresa.com" className="text-gray-600" />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-6">
                    <Button variant="outline" className="bg-[#273d60] text-white border-none hover:bg-[#273d60]/90 gap-2 w-28" onClick={() => {
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
                    }}>
                      <X className="w-4 h-4" />
                      Cancelar
                    </Button>
                    <Button className="bg-[#273d60] text-white hover:bg-[#273d60]/90 gap-2 w-28" onClick={handleSaveCompany}>
                      <Check className="w-4 h-4" />
                      Salvar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6 mt-6">
            <SubscriptionTab />
          </TabsContent>

          <TabsContent value="support" className="space-y-6 mt-6">
            <div className="flex justify-end mb-6">
              <CreateTicketSheet onTicketCreated={() => refetchTickets()} />
            </div>

            <Card className="border-0 bg-transparent md:bg-card">
              <CardContent className="p-0">
                {/* Desktop Table View */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Título</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Abertura</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Categoria</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Prioridade</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Ticket</th>
                        <th className="text-right p-4 font-semibold text-sm text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets && tickets.length > 0 ? tickets.map((ticket, index) => {
                      // Extract category and priority from description
                      const categoryMatch = ticket.description.match(/Categoria: ([^\n]+)/);
                      const priorityMatch = ticket.description.match(/Prioridade: ([^\n]+)/);
                      const category = categoryMatch ? categoryMatch[1] : '-';
                      const priority = priorityMatch ? priorityMatch[1] : '-';
                      return <tr key={ticket.id} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}`}>
                              <td className="p-4 text-sm">{ticket.title}</td>
                              <td className="p-4 text-sm text-gray-600">
                                {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="p-4 text-sm text-gray-600 capitalize">{category}</td>
                              <td className="p-4 text-sm text-gray-600 capitalize">{priority}</td>
                              <td className="p-4 text-sm text-gray-600">{ticket.ticket_number}</td>
                              <td className="p-4 text-right">
                                {getStatusBadge(ticket.status)}
                              </td>
                            </tr>;
                    }) : <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-gray-500">
                            Nenhum ticket encontrado. Clique em "Abrir Novo Ticket" para criar um.
                          </td>
                        </tr>}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {tickets && tickets.length > 0 ? tickets.map((ticket, index) => {
                    // Extract category and priority from description
                    const categoryMatch = ticket.description.match(/Categoria: ([^\n]+)/);
                    const priorityMatch = ticket.description.match(/Prioridade: ([^\n]+)/);
                    const category = categoryMatch ? categoryMatch[1] : '-';
                    const priority = priorityMatch ? priorityMatch[1] : '-';
                    
                    return (
                      <div key={ticket.id} className={`p-4 space-y-3 rounded-lg ${index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}`}>
                        <div>
                          <p className="text-xs text-gray-500">Título</p>
                          <p className="text-sm font-medium">{ticket.title}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Abertura</p>
                          <p className="text-sm text-gray-600">{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Categoria</p>
                          <p className="text-sm text-gray-600 capitalize">{category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Prioridade</p>
                          <p className="text-sm text-gray-600 capitalize">{priority}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Ticket</p>
                          <p className="text-sm text-gray-600">{ticket.ticket_number}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <div className="mt-1">{getStatusBadge(ticket.status)}</div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-8 text-center text-sm text-gray-500">
                      Nenhum ticket encontrado. Clique em "Abrir Novo Ticket" para criar um.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Email Section */}
            <Card className="border bg-gray-50">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-gray-600 mb-2">Precisa de mais ajuda?</p>
                <p className="text-sm text-gray-900">
                  Entre em contato: <a href="mailto:contato@eongerenciamento.com.br" className="text-[#273d60] font-semibold hover:underline">contato@eongerenciamento.com.br</a>
                </p>
              </CardContent>
            </Card>

            {/* Footer Logo */}
            <div className="flex justify-center pt-12 pb-4">
              <img 
                src="/logo-eon-sign.png" 
                alt="Eon Sign" 
                className="h-16 opacity-50 grayscale"
                style={{ filter: 'grayscale(100%) brightness(0.6)' }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>;
};
export default Settings;