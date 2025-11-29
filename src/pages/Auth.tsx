import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import { Session } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const authSchema = z.object({
  email: z.string().trim().email({
    message: "E-mail inválido"
  }),
  password: z.string().min(6, {
    message: "A senha deve ter no mínimo 6 caracteres"
  })
});
export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  useEffect(() => {
    // Set up auth state listener
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Check for existing session
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
      const validatedData = authSchema.parse({
        email,
        password
      });
      if (isLogin) {
        const {
          error
        } = await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password
        });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Erro ao entrar",
              description: "E-mail ou senha incorretos",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Erro ao entrar",
              description: error.message,
              variant: "destructive"
            });
          }
        } else {
          navigate("/dashboard");
        }
      } else {
        const redirectUrl = `${window.location.origin}/dashboard`;
        const {
          error
        } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Erro ao criar conta",
              description: "Este e-mail já está cadastrado",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Erro ao criar conta",
              description: error.message,
              variant: "destructive"
            });
          }
        } else {
          // Enviar email de boas-vindas
          try {
            await supabase.functions.invoke('send-welcome-email', {
              body: { email: validatedData.email }
            });
          } catch (emailError) {
            console.error("Error sending welcome email:", emailError);
          }
          
          toast({
            title: "Conta criada com sucesso!",
            description: "Você já pode fazer login. Verifique seu e-mail de boas-vindas!"
          });
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const emailSchema = z.string().email({ message: "E-mail inválido" });
      emailSchema.parse(resetEmail);

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) {
        toast({
          title: "Erro ao enviar e-mail",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha",
        });
        setShowResetDialog(false);
        setResetEmail("");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "E-mail inválido",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setIsResetting(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#273d60] to-[#001f3f] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center animate-fade-in animate-scale-in" style={{
        animationDelay: '0.1s'
      }}>
          <img src={logo} alt="ē o n ponto" className="mx-auto h-24 w-auto mb-8" />
        </div>

        <div className="p-8 rounded-lg shadow-xl opacity-90 bg-[#273d60] border border-white/20 animate-fade-in" style={{
        animationDelay: '0.3s'
      }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 animate-fade-in" style={{
            animationDelay: '0.5s'
          }}>
              <Label htmlFor="email" className="text-white">
                E-mail
              </Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white [&:-webkit-autofill]:!bg-[hsl(221,30%,35%)] [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_hsl(221,30%,35%)_inset]" />
            </div>

            <div className="space-y-2 animate-fade-in" style={{
            animationDelay: '0.6s'
          }}>
              <Label htmlFor="password" className="text-white">
                Senha
              </Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} className="bg-[hsl(221,30%,35%)] border border-white/20 text-white pr-10 [&:-webkit-autofill]:!bg-[hsl(221,30%,35%)] [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_hsl(221,30%,35%)_inset]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-transform hover:scale-110">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-3 animate-fade-in" style={{
            animationDelay: '0.7s'
          }}>
              <Button type="submit" variant="ghost" className="w-full text-white hover:bg-transparent hover:text-white/90 transition-transform hover:scale-105" disabled={isLoading}>
                {isLoading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              </Button>

              {isLogin && (
                <button 
                  type="button" 
                  onClick={() => setShowResetDialog(true)} 
                  className="w-full text-gray-50 hover:text-gray-50/80 transition-colors text-sm"
                >
                  Esqueci a senha
                </button>
              )}

              <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-gray-50 hover:text-gray-50/80 transition-colors text-sm">
                {isLogin ? "Criar nova conta" : "Já tenho conta"}
              </button>

              <Link to="/install" className="block w-full text-center text-gray-50 hover:text-gray-50/80 transition-colors text-sm">
                Instale o App
              </Link>
            </div>
          </form>
        </div>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-[#273d60] border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Recuperar Senha</DialogTitle>
            <DialogDescription className="text-gray-300">
              Digite seu e-mail para receber as instruções de recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-white">
                E-mail
              </Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={isResetting}
                className="bg-[hsl(221,30%,35%)] border border-white/20 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowResetDialog(false)}
                disabled={isResetting}
                className="flex-1 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isResetting}
                className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white hover:opacity-90"
              >
                {isResetting ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>;
}