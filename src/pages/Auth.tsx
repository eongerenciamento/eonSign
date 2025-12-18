import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { passwordSchema, passwordRequirementHint } from "@/utils/passwordSchema";
import { LOGO_URL } from "@/constants/assets";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: passwordSchema
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Static components moved outside Auth to prevent re-creation on every render
const RadialGlow = () => (
  <div 
    className="absolute inset-0" 
    style={{
      background: "radial-gradient(ellipse at center, rgba(100, 150, 255, 0.3) 0%, transparent 70%)"
    }} 
  />
);

const PoweredBy = () => (
  <div className="text-center space-y-3">
    <a 
      href="https://certifica.eonhub.com.br" 
      target="_blank" 
      rel="noopener noreferrer" 
      style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }} 
      className="inline-block px-4 py-2 text-white text-sm transition-all hover:opacity-90 font-normal rounded-full"
    >
      Certificado Digital <span className="text-xs">R$</span>109.90
    </a>
    <div>
      <span className="text-gray-400 text-sm">
        Powered by{" "}
        <a 
          href="https://eonhub.com.br" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="font-bold text-gray-300 hover:text-gray-400 transition-colors"
        >
          eonhub
        </a>
      </span>
    </div>
  </div>
);

const PoweredBySimple = () => (
  <div className="text-center">
    <span className="text-gray-400 text-sm">
      Powered by{" "}
      <a 
        href="https://eonhub.com.br" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="font-bold text-gray-300 hover:text-gray-400 transition-colors"
      >
        eonhub
      </a>
    </span>
  </div>
);

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });
  
  const isSubmitting = form.formState.isSubmitting;

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
      
      if (error) {
        throw error;
      }
      
      navigate("/dashboard");
    } catch (error) {
      const description = error instanceof Error && error.message 
        ? error.message 
        : "Tente novamente em instantes.";
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description
      });
    }
  };

  const handleForgotPassword = async () => {
    const emailValue = form.getValues("email");
    
    if (!emailValue) {
      toast({
        variant: "destructive",
        title: "Digite seu e-mail",
        description: "Informe o e-mail para enviarmos o link de recuperação."
      });
      return;
    }
    
    const isEmailValid = await form.trigger("email");
    if (!isEmailValid) return;
    
    setResettingPassword(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset-email", {
        body: { email: emailValue }
      });
      
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Não foi possível enviar o e-mail de recuperação.");
      }
      
      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para redefinir a senha."
      });
    } catch (error) {
      const description = error instanceof Error && error.message 
        ? error.message 
        : "Erro ao processar a solicitação.";
      toast({
        variant: "destructive",
        title: "Erro ao enviar e-mail",
        description
      });
    } finally {
      setResettingPassword(false);
    }
  };

  // Input styles for the new white form design
  const inputClassName = "bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400";
  const labelClassName = "text-gray-700";

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>E-mail</FormLabel>
              <FormControl>
                <Input {...field} type="email" disabled={isSubmitting} className={inputClassName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Senha</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    disabled={isSubmitting}
                    className={`${inputClassName} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="w-full bg-[#273D60] hover:bg-[#1a2847] text-white"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>

        {/* Links */}
        <div className="flex flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isSubmitting || resettingPassword}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center"
          >
            {resettingPassword && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Esqueci a senha
          </button>
          <span className="text-gray-300">·</span>
          <a
            href="https://eonhub.com.br/sign"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Criar nova conta
          </a>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={() => navigate("/install")}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Instale o App
          </button>
        </div>
        <a
          href="https://certifica.eonhub.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="md:hidden mt-3 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-200 transition-colors block mx-auto w-fit"
        >
          Certificado Digital <span className="text-xs">R$</span>109.90
        </a>
      </form>
    </Form>
  );

  return (
    <>
      {/* Mobile Layout */}
      <div className="md:hidden min-h-screen flex flex-col">
        {/* Blue gradient header */}
        <div
          className="relative flex-shrink-0 pt-[env(safe-area-inset-top)] px-6 pb-24"
          style={{ background: "linear-gradient(to bottom, #273D60, #1a2847)" }}
        >
          <RadialGlow />
          
          {/* Logo */}
          <div className="relative z-20 flex justify-center pt-12">
            <img src={LOGO_URL} alt="Logo" className="h-16 w-auto" />
          </div>
        </div>

        {/* White card with form */}
        <div className="flex-1 bg-white rounded-t-3xl -mt-8 px-6 py-8 relative z-30 flex flex-col">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Login</h1>
            <p className="text-gray-500 mt-1">Bem-vindo de volta!</p>
          </div>

          {formContent}

          {/* Footer */}
          <div className="mt-auto pt-6">
            <PoweredBySimple />
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-screen">
        {/* Left side - Blue gradient with radial glow (40%) */}
        <div
          className="relative w-[40%] flex flex-col items-center justify-center rounded-r-2xl overflow-hidden"
          style={{ background: "linear-gradient(to bottom, #273D60, #1a2847)" }}
        >
          <RadialGlow />
          
          {/* Logo */}
          <div className="relative z-10">
            <img src={LOGO_URL} alt="Logo" className="h-24 w-auto" />
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 left-0 right-0 z-10">
            <PoweredBy />
          </div>
        </div>

        {/* Right side - White form (60%) */}
        <div className="w-[60%] bg-white flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Login</h1>
              <p className="text-gray-500 mt-1">Bem-vindo de volta!</p>
            </div>

            {formContent}
          </div>
        </div>
      </div>
    </>
  );
}
