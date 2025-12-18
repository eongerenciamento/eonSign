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
import { useEffect, useState, useRef, useCallback } from "react";
import { Upload, Building2, CreditCard, X, Check, ClipboardList, MessageCircle, Shield, Lock, Sun, Moon } from "lucide-react";
import { SubscriptionTab } from "@/components/settings/SubscriptionTab";
import { CreateTicketSheet } from "@/components/settings/CreateTicketSheet";
import { TicketChatSheet } from "@/components/settings/TicketChatSheet";
import { CadastrosTab } from "@/components/settings/CadastrosTab";
import { CertificateUpload } from "@/components/settings/CertificateUpload";
import { AdminPanelTab } from "@/components/settings/AdminPanelTab";
import { AdminCouponsTab } from "@/components/settings/AdminCouponsTab";
import { AdminTicketsTab } from "@/components/settings/AdminTicketsTab";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useThemePreference } from "@/hooks/useThemePreference";
const Settings = () => {
  const { isDark, toggleTheme, mounted } = useThemePreference();
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
  const [adminBirthDate, setAdminBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(true);
  const [isHealthcare, setIsHealthcare] = useState(false);
  const [professionalCouncil, setProfessionalCouncil] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationState, setRegistrationState] = useState("");
  const [medicalSpecialty, setMedicalSpecialty] = useState("");
  // Healthcare professional address
  const [healthcareCep, setHealthcareCep] = useState("");
  const [healthcareStreet, setHealthcareStreet] = useState("");
  const [healthcareNeighborhood, setHealthcareNeighborhood] = useState("");
  const [healthcareCity, setHealthcareCity] = useState("");
  const [healthcareState, setHealthcareState] = useState("");

  // Certificate data
  const [certificateData, setCertificateData] = useState<{
    certificate_file_url: string | null;
    certificate_subject: string | null;
    certificate_issuer: string | null;
    certificate_valid_from: string | null;
    certificate_valid_to: string | null;
    certificate_serial_number: string | null;
    certificate_uploaded_at: string | null;
  } | null>(null);

  // Selected ticket for chat
  const [selectedTicket, setSelectedTicket] = useState<{
    id: string;
    title: string;
    description: string;
    status: string;
    ticket_number: string;
    created_at: string;
    user_id: string;
  } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Admin states
  const SYSTEM_ADMIN_EMAIL = "marcus@mav.eng.br";
  const ADMIN_PASSWORD = "230502";
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSubTab, setAdminSubTab] = useState("panel");
  const isSystemAdmin = user?.email === SYSTEM_ADMIN_EMAIL;

  // Get tab from URL params - default to 'company' for admins, redirect members away from restricted tabs
  const urlTab = searchParams.get('tab') || 'company';
  // Redirect old tabs (members, contacts, groups) to cadastros
  const normalizedTab = ['members', 'contacts', 'groups'].includes(urlTab) ? 'cadastros' : urlTab;
  const activeTab = !isAdmin && normalizedTab === 'subscription' ? 'company' : normalizedTab;

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
        // Check if user is a member (not admin)
        const {
          data: memberData
        } = await supabase.from('organization_members').select('*').eq('member_user_id', user.id).eq('status', 'active').single();

        // User is admin if they are NOT a member of another organization
        setIsAdmin(!memberData);

        // Load company data from user's own settings or organization's settings
        const organizationId = memberData?.organization_id || user.id;
        const {
          data: companyData
        } = await supabase.from('company_settings').select('*').eq('user_id', organizationId).single();
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
          setAdminBirthDate((companyData as any).admin_birth_date || "");
          setPhone(companyData.admin_phone);
          setCompanyEmail(companyData.admin_email);
          setIsHealthcare((companyData as any).is_healthcare || false);
          setProfessionalCouncil((companyData as any).professional_council || "");
          setRegistrationNumber((companyData as any).professional_registration || "");
          setRegistrationState((companyData as any).registration_state || "");
          setMedicalSpecialty((companyData as any).medical_specialty || "");
          // Healthcare address
          setHealthcareCep((companyData as any).healthcare_cep || "");
          setHealthcareStreet((companyData as any).healthcare_street || "");
          setHealthcareNeighborhood((companyData as any).healthcare_neighborhood || "");
          setHealthcareCity((companyData as any).healthcare_city || "");
          setHealthcareState((companyData as any).healthcare_state || "");
          // Certificate data
          setCertificateData({
            certificate_file_url: (companyData as any).certificate_file_url || null,
            certificate_subject: (companyData as any).certificate_subject || null,
            certificate_issuer: (companyData as any).certificate_issuer || null,
            certificate_valid_from: (companyData as any).certificate_valid_from || null,
            certificate_valid_to: (companyData as any).certificate_valid_to || null,
            certificate_serial_number: (companyData as any).certificate_serial_number || null,
            certificate_uploaded_at: (companyData as any).certificate_uploaded_at || null
          });
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
  const handleHealthcareCepChange = async (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const formatted = formatCEP(value);
    setHealthcareCep(formatted);
    if (numbers.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setHealthcareStreet(data.logradouro || "");
          setHealthcareNeighborhood(data.bairro || "");
          setHealthcareCity(data.localidade || "");
          setHealthcareState(data.uf || "");
        } else {
          toast.error("CEP não encontrado");
        }
      } catch (error) {
        toast.error("Erro ao buscar CEP");
      }
    }
  };
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!user) return;
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/logo_${Date.now()}.${fileExt}`;
        const {
          error: uploadError
        } = await supabase.storage.from('avatars').upload(fileName, file);
        if (uploadError) throw uploadError;
        const {
          data: {
            publicUrl
          }
        } = supabase.storage.from('avatars').getPublicUrl(fileName);
        setLogo(publicUrl);
        toast.success("Logo atualizada!");
      } catch (error) {
        toast.error("Erro ao fazer upload da logo");
      }
    }
  };
  const handleSaveCompany = async () => {
    if (!user) return;
    if (!companyName || !cnpj || !cep || !street || !neighborhood || !city || !state || !adminName || !adminCpf || !phone || !companyEmail) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    // Validate healthcare fields if healthcare is enabled
    if (isHealthcare && (!professionalCouncil || !registrationNumber || !registrationState)) {
      toast.error("Por favor, preencha o conselho de classe, número do registro e estado");
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
      admin_birth_date: adminBirthDate || null,
      admin_phone: phone,
      admin_email: companyEmail,
      is_healthcare: isHealthcare,
      professional_council: isHealthcare ? professionalCouncil : null,
      professional_registration: isHealthcare ? registrationNumber : null,
      registration_state: isHealthcare ? registrationState : null,
      medical_specialty: isHealthcare && ['CRM', 'CRO'].includes(professionalCouncil) ? medicalSpecialty : null,
      healthcare_cep: isHealthcare ? healthcareCep : null,
      healthcare_street: isHealthcare ? healthcareStreet : null,
      healthcare_neighborhood: isHealthcare ? healthcareNeighborhood : null,
      healthcare_city: isHealthcare ? healthcareCity : null,
      healthcare_state: isHealthcare ? healthcareState : null
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
  const handleCertificateChange = useCallback(async () => {
    if (!user) return;
    const {
      data: companyData
    } = await supabase.from('company_settings').select('certificate_file_url, certificate_subject, certificate_issuer, certificate_valid_from, certificate_valid_to, certificate_serial_number, certificate_uploaded_at').eq('user_id', user.id).single();
    if (companyData) {
      setCertificateData({
        certificate_file_url: (companyData as any).certificate_file_url || null,
        certificate_subject: (companyData as any).certificate_subject || null,
        certificate_issuer: (companyData as any).certificate_issuer || null,
        certificate_valid_from: (companyData as any).certificate_valid_from || null,
        certificate_valid_to: (companyData as any).certificate_valid_to || null,
        certificate_serial_number: (companyData as any).certificate_serial_number || null,
        certificate_uploaded_at: (companyData as any).certificate_uploaded_at || null
      });
    } else {
      setCertificateData(null);
    }
  }, [user]);
  return <Layout>
      <div className="p-8 pb-20 space-y-6 w-full overflow-hidden">
        <div className="w-full mx-auto max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-sm font-bold text-muted-foreground">Configurações</h1>
            <div className="flex items-center gap-4">
              {/* Theme Switch */}
              {mounted && (
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    checked={isDark}
                    onCheckedChange={toggleTheme}
                    className="data-[state=checked]:bg-muted-foreground"
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <Button onClick={() => window.open('https://certifica.eonhub.com.br', '_blank')} className="md:hidden bg-[#283d60] text-white font-light hover:bg-[#283d60]/90 text-xs px-3 py-1 h-auto">
                Certificado A1 R$109.90
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={value => navigate(`/configuracoes?tab=${value}`)} className="w-full">
          <TabsList className={`grid w-full ${isSystemAdmin ? 'grid-cols-5' : isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden md:inline">Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="cadastros" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden md:inline">Cadastros</span>
            </TabsTrigger>
            {isAdmin && <TabsTrigger value="subscription" className="gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden md:inline">Assinatura</span>
              </TabsTrigger>}
            <TabsTrigger value="support" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden md:inline">Suporte</span>
            </TabsTrigger>
            {isSystemAdmin && <TabsTrigger value="admin" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden md:inline">Admin</span>
              </TabsTrigger>}
          </TabsList>

          <TabsContent value="company" className="space-y-6 mt-6">
            <Card className="bg-secondary dark:bg-card shadow-md border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground text-base">Informações da Empresa</CardTitle>
                
                {/* Logo Upload */}
                <div className="relative">
                  <div className="relative w-14 h-14 rounded-full bg-muted border-2 border-muted-foreground/25 flex items-center justify-center overflow-hidden">
                    {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                  </div>
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white flex items-center justify-center hover:opacity-90 transition-opacity">
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
                      <Input id="company-name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Digite o nome da empresa" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input id="cnpj" value={cnpj} onChange={e => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="street">Endereço</Label>
                    <Input id="street" value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua, Avenida..." className="text-foreground border-0 bg-muted dark:bg-secondary" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input id="cep" value={cep} onChange={e => handleCepChange(e.target.value)} placeholder="00.000-000" maxLength={10} inputMode="numeric" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input id="neighborhood" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Bairro" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input id="state" value={state} onChange={e => setState(e.target.value)} placeholder="UF" maxLength={2} className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="admin-name">Nome do Sócio Administrador</Label>
                      <Input id="admin-name" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Nome completo" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="user-id">ID do Usuário</Label>
                      <Input id="user-id" value={user?.id || ""} disabled className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="admin-cpf">CPF do Sócio Administrador</Label>
                      <Input id="admin-cpf" value={adminCpf} onChange={e => handleCpfChange(e.target.value)} placeholder="000.000.000-00" maxLength={14} inputMode="numeric" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="admin-birth-date">Data de Nascimento</Label>
                      <Input id="admin-birth-date" type="date" value={adminBirthDate} onChange={e => setAdminBirthDate(e.target.value)} className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="company-phone">Telefone</Label>
                      <Input id="company-phone" value={phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="(00)00000-0000" maxLength={14} inputMode="tel" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="company-email">E-mail</Label>
                      <Input id="company-email" type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="contato@empresa.com" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Healthcare Professional Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is-healthcare" className="text-sm font-medium">
                        Profissional da Área da Saúde
                      </Label>
                      <Switch id="is-healthcare" checked={isHealthcare} onCheckedChange={setIsHealthcare} />
                    </div>

                    {isHealthcare && <>
                        <div className="grid md:grid-cols-3 gap-4 pl-0 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid gap-2">
                            <Label htmlFor="council-type">Conselho de Classe</Label>
                            <Select value={professionalCouncil} onValueChange={setProfessionalCouncil}>
                            <SelectTrigger className="text-foreground border-0 bg-muted dark:bg-secondary">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {['CRM', 'CRO', 'CRN', 'COREN', 'CRF', 'CREFITO', 'CRP', 'CRBM', 'CRBIO', 'CRFa', 'CRTR', 'CRV', 'CRMV', 'COFFITO'].map(council => <SelectItem key={council} value={council}>{council}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="registration-number">Número do Registro</Label>
                            <Input id="registration-number" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} placeholder="Ex: 12345" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="registration-state">Estado</Label>
                            <Select value={registrationState} onValueChange={setRegistrationState}>
                              <SelectTrigger className="text-foreground border-0 bg-muted dark:bg-secondary">
                                <SelectValue placeholder="UF" />
                              </SelectTrigger>
                              <SelectContent>
                                {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Medical Specialty - Only for CRM and CRO */}
                        {['CRM', 'CRO'].includes(professionalCouncil) && <div className="grid gap-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Label htmlFor="medical-specialty">Especialidade</Label>
                            <Input id="medical-specialty" value={medicalSpecialty} onChange={e => setMedicalSpecialty(e.target.value)} placeholder={professionalCouncil === 'CRM' ? 'Ex: Cardiologia, Pediatria' : 'Ex: Ortodontia, Endodontia'} className="text-foreground border-0 bg-muted dark:bg-secondary" />
                          </div>}

                        {/* Healthcare Professional Address */}
                        <Separator className="my-4" />
                        <p className="text-sm font-medium text-muted-foreground">Endereço do Consultório</p>
                        
                        <div className="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid gap-2">
                            <Label htmlFor="healthcare-cep">CEP</Label>
                            <Input id="healthcare-cep" value={healthcareCep} onChange={e => handleHealthcareCepChange(e.target.value)} placeholder="00.000-000" maxLength={10} inputMode="numeric" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="healthcare-street">Endereço</Label>
                            <Input id="healthcare-street" value={healthcareStreet} onChange={e => setHealthcareStreet(e.target.value)} placeholder="Rua, Avenida..." className="text-foreground border-0 bg-muted dark:bg-secondary" />
                          </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid gap-2">
                            <Label htmlFor="healthcare-neighborhood">Bairro</Label>
                            <Input id="healthcare-neighborhood" value={healthcareNeighborhood} onChange={e => setHealthcareNeighborhood(e.target.value)} placeholder="Bairro" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="healthcare-city">Cidade</Label>
                            <Input id="healthcare-city" value={healthcareCity} onChange={e => setHealthcareCity(e.target.value)} placeholder="Cidade" className="text-foreground border-0 bg-muted dark:bg-secondary" />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="healthcare-state">Estado</Label>
                            <Select value={healthcareState} onValueChange={setHealthcareState}>
                              <SelectTrigger className="text-foreground border-0 bg-muted dark:bg-secondary">
                                <SelectValue placeholder="UF" />
                              </SelectTrigger>
                              <SelectContent>
                                {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </>}
                  </div>

                  <div className="flex gap-3 justify-end pt-6">
                    <Button variant="ghost" className="bg-transparent text-gray-500 border-0 hover:bg-transparent hover:text-gray-500 gap-2 w-28" onClick={() => {
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
                    <Button className="bg-muted dark:bg-secondary text-foreground hover:bg-muted/80 dark:hover:bg-secondary/80 gap-2 w-28 rounded-lg" onClick={handleSaveCompany}>
                      <Check className="w-4 h-4" />
                      Salvar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Certificate Upload */}
            {user && <CertificateUpload userId={user.id} certificateData={certificateData} onCertificateChange={handleCertificateChange} />}

            {/* Footer */}
            <div className="flex flex-col items-center pt-8 pb-4">
              <p className="text-sm text-gray-500">eonSign</p>
              <p className="text-xs text-gray-400">
                Powered by <a href="https://www.eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">eonhub</a>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="cadastros">
            <CadastrosTab isAdmin={isAdmin} />
            {/* Footer */}
            <div className="flex flex-col items-center pt-8 pb-4">
              <p className="text-sm text-gray-500">eonSign</p>
              <p className="text-xs text-gray-400">
                Powered by <a href="https://www.eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">eonhub</a>
              </p>
            </div>
          </TabsContent>

          {isAdmin && <TabsContent value="subscription" className="space-y-6 mt-6">
              <SubscriptionTab />
              {/* Footer */}
              <div className="flex flex-col items-center pt-8 pb-4">
                <p className="text-sm text-gray-500">eonSign</p>
                <p className="text-xs text-gray-400">
                  Powered by <a href="https://www.eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">eonhub</a>
                </p>
              </div>
            </TabsContent>}

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
                      <tr className="bg-gray-100">
                        <th className="text-left p-4 font-semibold text-sm text-gray-700 rounded-tl-lg rounded-bl-lg">Título</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Abertura</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Categoria</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Prioridade</th>
                        <th className="text-left p-4 font-semibold text-sm text-gray-700">Ticket</th>
                        <th className="text-right p-4 font-semibold text-sm text-gray-700 rounded-tr-lg rounded-br-lg">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets && tickets.length > 0 ? tickets.map((ticket, index) => {
                        // Extract category and priority from description
                        const categoryMatch = ticket.description.match(/Categoria: ([^\n]+)/);
                        const priorityMatch = ticket.description.match(/Prioridade: ([^\n]+)/);
                        const category = categoryMatch ? categoryMatch[1] : '-';
                        const priority = priorityMatch ? priorityMatch[1] : '-';
                        return <tr 
                          key={ticket.id} 
                          className={`hover:bg-gray-50 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}`}
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setChatOpen(true);
                          }}
                        >
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
                    return <div 
                      key={ticket.id} 
                      className={`p-4 space-y-3 rounded-lg cursor-pointer ${index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}`}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setChatOpen(true);
                      }}
                    >
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
                      </div>;
                  }) : <div className="p-8 text-center text-sm text-gray-500">
                      Nenhum ticket encontrado. Clique em "Abrir Novo Ticket" para criar um.
                    </div>}
                </div>
              </CardContent>
            </Card>

            {/* Contact Email Section */}
            <Card className="border bg-gray-50">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-gray-600 mb-2">Precisa de mais ajuda?</p>
                <p className="text-sm text-gray-900">
                  Entre em contato: <a href="mailto:contato@eonhub.com.br" className="font-semibold hover:underline text-blue-700">contato@eonhub.com.br</a>
                </p>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="flex flex-col items-center pt-8 pb-4">
              <p className="text-sm text-gray-500">eonSign</p>
              <p className="text-xs text-gray-400">
                Powered by <a href="https://www.eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">eonhub</a>
              </p>
            </div>
          </TabsContent>

          {/* Admin Tab - Only for system admin */}
          {isSystemAdmin && <TabsContent value="admin" className="space-y-6 mt-6">
            {!adminUnlocked ? (
              <Card className="bg-card shadow-md border-border max-w-md mx-auto">
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-[#273d60] rounded-full flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-foreground">Área Restrita</CardTitle>
                  <CardDescription>Digite a senha para acessar o painel administrativo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="password"
                    placeholder="Senha de acesso"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="bg-secondary border-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (adminPassword === ADMIN_PASSWORD) {
                          setAdminUnlocked(true);
                          toast.success("Acesso liberado!");
                        } else {
                          toast.error("Senha incorreta");
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (adminPassword === ADMIN_PASSWORD) {
                        setAdminUnlocked(true);
                        toast.success("Acesso liberado!");
                      } else {
                        toast.error("Senha incorreta");
                      }
                    }}
                    className="w-full bg-[#273d60] hover:bg-[#273d60]/90 text-white"
                  >
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Tabs value={adminSubTab} onValueChange={setAdminSubTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="panel">Painel</TabsTrigger>
                    <TabsTrigger value="coupons">Cupons</TabsTrigger>
                    <TabsTrigger value="tickets">Tickets</TabsTrigger>
                  </TabsList>
                  <TabsContent value="panel" className="mt-6">
                    <AdminPanelTab />
                  </TabsContent>
                  <TabsContent value="coupons" className="mt-6">
                    <AdminCouponsTab />
                  </TabsContent>
                  <TabsContent value="tickets" className="mt-6">
                    <AdminTicketsTab />
                  </TabsContent>
                </Tabs>
              </div>
            )}
            {/* Footer */}
            <div className="flex flex-col items-center pt-8 pb-4">
              <p className="text-sm text-gray-500">eonSign</p>
              <p className="text-xs text-gray-400">
                Powered by <a href="https://www.eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">eonhub</a>
              </p>
            </div>
          </TabsContent>}
          </Tabs>
        </div>
      </div>

      {/* Ticket Chat Sheet */}
      <TicketChatSheet
        ticket={selectedTicket}
        open={chatOpen}
        onOpenChange={setChatOpen}
        onTicketUpdated={() => refetchTickets()}
      />
      
    </Layout>;
};
export default Settings;