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

        <Button type="submit" disabled={isSubmitting} className="w-full bg-[#273D60] hover:bg-[#1a2847] text-white">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
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
