import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { passwordSchema } from "@/utils/passwordSchema";
import { lovable } from "@/integrations/lovable";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: passwordSchema
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess: () => void;
  onRegisterClick: () => void;
  onInstallClick: () => void;
}

export function LoginForm({ onSuccess, onRegisterClick, onInstallClick }: LoginFormProps) {
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
  const inputClassName = "bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400";
  const labelClassName = "text-gray-700";

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
      if (error) throw error;
      onSuccess();
    } catch (error) {
      const description = error instanceof Error && error.message ? error.message : "Tente novamente em instantes.";
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
      const description = error instanceof Error && error.message ? error.message : "Erro ao processar a solicitação.";
      toast({
        variant: "destructive",
        title: "Erro ao enviar e-mail",
        description
      });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
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

        <Button type="submit" disabled={isSubmitting} className="w-full bg-[#273D60] hover:bg-[#1a2847] text-white rounded-full border-0">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>

        <Button
          type="button"
          disabled={isSubmitting}
          onClick={async () => {
            const { error } = await lovable.auth.signInWithOAuth("google", {
              redirect_uri: window.location.origin,
            });
            if (error) {
              toast({
                variant: "destructive",
                title: "Erro ao fazer login com Google",
                description: error.message || "Tente novamente em instantes.",
              });
            }
          }}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border-0"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar com Google
        </Button>

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
          <button
            type="button"
            onClick={onRegisterClick}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Criar nova conta
          </button>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={onInstallClick}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Instale o App
          </button>
        </div>
      </form>
    </Form>
  );
}
