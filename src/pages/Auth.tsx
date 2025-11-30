import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import { Session } from "@supabase/supabase-js";
const loginSchema = z.object({
  email: z.string().trim().email({
    message: "E-mail inválido"
  }),
  password: z.string().min(6, {
    message: "A senha deve ter no mínimo 6 caracteres"
  })
});
const signupSchema = z.object({
  organizationName: z.string().trim().min(1, {
    message: "Nome da organização é obrigatório"
  }),
  cnpj: z.string().trim().min(14, {
    message: "CNPJ inválido"
  }),
  adminName: z.string().trim().min(1, {
    message: "Nome do membro é obrigatório"
  }),
  adminCpf: z.string().trim().min(11, {
    message: "CPF inválido"
  }),
  adminPhone: z.string().trim().min(10, {
    message: "Telefone inválido"
  }),
  email: z.string().trim().email({
    message: "E-mail inválido"
  }),
  password: z.string().min(6, {
    message: "A senha deve ter no mínimo 6 caracteres"
  }),
  confirmPassword: z.string().min(6, {
    message: "Confirmação de senha obrigatória"
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"]
});
export default function Auth() {
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan');
  const selectedPlanName = searchParams.get('planName');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminCpf, setAdminCpf] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Máscaras de formatação
  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  };
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1)$2-$3');
    }
    return numbers.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1)$2-$3');
  };
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    // Se veio da página de planos, abrir em modo signup
    if (selectedPlan) {
      setIsLogin(false);
    }
  }, [selectedPlan]);

  useEffect(() => {
    if (session) {
      navigate("/dashboard");
    }
  }, [session, navigate]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        const validatedData = loginSchema.parse({
          email,
          password
        });
        const {
          error
        } = await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password
        });
        if (error) {
          toast({
            title: "Erro ao entrar",
            description: error.message.includes("Invalid login credentials") ? "E-mail ou senha incorretos" : error.message,
            variant: "destructive"
          });
        } else {
          navigate("/dashboard");
        }
      } else {
        const validatedData = signupSchema.parse({
          organizationName,
          cnpj: cnpj.replace(/\D/g, ''),
          adminName,
          adminCpf: adminCpf.replace(/\D/g, ''),
          adminPhone: adminPhone.replace(/\D/g, ''),
          email,
          password,
          confirmPassword
        });
        const redirectUrl = `${window.location.origin}/dashboard`;
        const {
          data: authData,
          error: signUpError
        } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });
        if (signUpError) {
          toast({
            title: "Erro ao criar conta",
            description: signUpError.message.includes("User already registered") ? "Este e-mail já está cadastrado" : signUpError.message,
            variant: "destructive"
          });
          return;
        }
        if (authData.user) {
          const {
            error: companyError
          } = await supabase.from('company_settings').insert({
            user_id: authData.user.id,
            company_name: validatedData.organizationName,
            cnpj: validatedData.cnpj,
            admin_name: validatedData.adminName,
            admin_cpf: validatedData.adminCpf,
            admin_phone: validatedData.adminPhone,
            admin_email: validatedData.email
          });
          if (companyError) {
            console.error("Error creating company settings:", companyError);
            toast({
              title: "Erro ao salvar dados",
              description: "Não foi possível salvar as informações da empresa",
              variant: "destructive"
            });
            return;
          }

          // Processar plano selecionado
          if (selectedPlan && selectedPlan !== 'free') {
            // Se for plano pago, redirecionar para checkout Stripe
            try {
              const planLimits: Record<string, number> = {
                'price_1SZBDZHRTD5WvpxjeKMhFcSK': 20, // Básico
                'price_1SZBEAHRTD5Wvpxj0pcztkPt': 50, // Profissional
                'price_1SZBEOHRTD5WvpxjFsV37k0o': 100, // Empresarial
                'price_1SZBEdHRTD5Wvpxj46hhdp54': 500, // Premium
                'price_1SZBEsHRTD5Wvpxj6t1lc01Z': 1000, // Enterprise
              };

              const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-stripe-checkout", {
                body: {
                  priceId: selectedPlan,
                  tierName: selectedPlanName || 'Plano Selecionado',
                  documentLimit: planLimits[selectedPlan] || 20,
                },
              });

              if (checkoutError) throw checkoutError;

              if (checkoutData.url) {
                // Abrir checkout em nova aba
                window.open(checkoutData.url, "_blank");
                toast({
                  title: "Conta criada com sucesso!",
                  description: "Complete o pagamento na nova aba para ativar seu plano"
                });
              }
            } catch (checkoutError) {
              console.error("Error creating checkout:", checkoutError);
              toast({
                title: "Conta criada, mas erro no checkout",
                description: "Você pode fazer upgrade depois nas configurações",
                variant: "destructive"
              });
            }
          } else {
            // Plano gratuito - apenas criar subscription padrão
            await supabase.from('user_subscriptions').insert({
              user_id: authData.user.id,
              stripe_customer_id: '', // Será preenchido quando criar cliente Stripe
              plan_name: 'Grátis',
              status: 'active',
              document_limit: 5,
            });

            toast({
              title: "Conta criada com sucesso!",
              description: "Você já pode fazer login com o plano gratuito!"
            });
          }

          try {
            await supabase.functions.invoke('send-welcome-email', {
              body: {
                email: validatedData.email,
                name: validatedData.adminName,
                userId: authData.user.id
              }
            });
          } catch (emailError) {
            console.error("Error sending welcome email:", emailError);
          }

          setIsLogin(true);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, preencha o campo de e-mail primeiro",
        variant: "destructive"
      });
      return;
    }
    try {
      const emailSchema = z.string().email({
        message: "E-mail inválido"
      });
      emailSchema.parse(email);
      setIsLoading(true);
      const {
        error
      } = await supabase.functions.invoke('send-password-reset-email', {
        body: {
          email
        }
      });
      if (error) {
        toast({
          title: "Erro ao enviar e-mail",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Nova senha enviada!",
          description: "Verifique seu e-mail para acessar com a nova senha"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "E-mail inválido",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#273d60] to-[#001f3f] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center animate-fade-in animate-scale-in" style={{
        animationDelay: '0.1s'
      }}>
          <img alt="ē o n ponto" className="mx-auto h-24 w-auto mb-8" src="/lovable-uploads/064fa19f-41fd-43f6-a45f-95f030679937.png" />
        </div>

        <div className="p-8 rounded-lg shadow-xl opacity-90 bg-[#273d60] border border-white/20 animate-fade-in" style={{
        animationDelay: '0.3s'
      }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {isLogin ? <>
                <div className="space-y-2 animate-fade-in" style={{
              animationDelay: '0.5s'
            }}>
                  <Label htmlFor="email" className="text-white">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white [&:-webkit-autofill]:!bg-[hsl(221,30%,35%)] [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_hsl(221,30%,35%)_inset]" />
                </div>

                <div className="space-y-2 animate-fade-in" style={{
              animationDelay: '0.6s'
            }}>
                  <Label htmlFor="password" className="text-white">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white pr-10 [&:-webkit-autofill]:!bg-[hsl(221,30%,35%)] [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_hsl(221,30%,35%)_inset]" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-transform hover:scale-110">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </> : <>
                <div className="space-y-4">
                  <h3 className="text-white text-sm font-medium">Dados da Empresa</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="organizationName" className="text-white">Nome da Organização</Label>
                    <Input id="organizationName" type="text" value={organizationName} onChange={e => setOrganizationName(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cnpj" className="text-white">CNPJ</Label>
                    <Input id="cnpj" type="text" value={cnpj} onChange={e => setCnpj(formatCNPJ(e.target.value))} required disabled={isLoading} maxLength={18} placeholder="00.000.000/0000-00" className="bg-[hsl(221,30%,35%)] border border-white/20 text-white" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-white text-sm font-medium">Dados do Administrador</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="adminName" className="text-white">Nome do Membro</Label>
                    <Input id="adminName" type="text" value={adminName} onChange={e => setAdminName(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminCpf" className="text-white">CPF</Label>
                    <Input id="adminCpf" type="text" value={adminCpf} onChange={e => setAdminCpf(formatCPF(e.target.value))} required disabled={isLoading} maxLength={14} placeholder="000.000.000-00" className="bg-[hsl(221,30%,35%)] border border-white/20 text-white" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPhone" className="text-white">Telefone</Label>
                    <Input id="adminPhone" type="text" value={adminPhone} onChange={e => setAdminPhone(formatPhone(e.target.value))} required disabled={isLoading} maxLength={14} placeholder="(00)00000-0000" className="bg-[hsl(221,30%,35%)] border border-white/20 text-white" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-white text-sm font-medium">Credenciais</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">E-mail</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">Senha</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-white">Confirmação de Senha</Label>
                    <div className="relative">
                      <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white pr-10" />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              </>}

            <div className="space-y-3 animate-fade-in" style={{
            animationDelay: '0.7s'
          }}>
              <Button type="submit" variant="ghost" className="w-full text-white hover:bg-transparent hover:text-white/90 transition-transform hover:scale-105" disabled={isLoading}>
                {isLoading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              </Button>

              {isLogin && <button type="button" onClick={handleForgotPassword} className="w-full text-gray-50 hover:text-gray-50/80 transition-colors text-sm" disabled={isLoading}>
                  Esqueci a senha
                </button>}

              <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-gray-50 hover:text-gray-50/80 transition-colors text-sm" disabled={isLoading}>
                {isLogin ? "Criar nova conta" : "Já tenho conta"}
              </button>

              <Link to="/install" className="block w-full text-center text-gray-50 hover:text-gray-50/80 transition-colors text-sm">
                Instale o App
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>;
}