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
    if (session) {
      navigate("/dashboard");
    }
  }, [session, navigate]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = loginSchema.safeParse({
        email,
        password
      });
      if (!result.success) {
        const firstError = result.error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      const {
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        toast({
          title: "Erro ao entrar",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Bem-vindo!",
          description: "Login realizado com sucesso."
        });
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error during login:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro durante o login.",
        variant: "destructive"
      });
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
          <img alt="ē o n ponto" className="mx-auto h-24 w-auto mb-8" src="/lovable-uploads/86300fa7-7f6a-4b88-b2b9-978491efec2c.png" />
        </div>

        <div className="p-8 rounded-lg shadow-xl opacity-90 bg-[#273d60] border border-white/20 animate-fade-in" style={{
        animationDelay: '0.3s'
      }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
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
            </div>

            <div className="space-y-3 animate-fade-in" style={{
            animationDelay: '0.7s'
          }}>
              <Button type="submit" variant="ghost" className="w-full text-white hover:bg-transparent hover:text-white/90 transition-transform hover:scale-105" disabled={isLoading}>
                {isLoading ? "Carregando..." : "Entrar"}
              </Button>

              <button type="button" onClick={handleForgotPassword} disabled={isLoading} className="w-full transition-colors text-sm text-gray-300">
                Esqueci a senha
              </button>

              <button type="button" onClick={() => navigate('/planos')} disabled={isLoading} className="w-full transition-colors text-sm text-gray-300">
                Criar nova conta
              </button>

              <Link to="/install" className="block w-full text-center transition-colors text-sm text-gray-300">
                Instale o App
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>;
}