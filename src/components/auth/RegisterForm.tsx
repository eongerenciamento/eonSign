import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const registerSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255, "E-mail muito longo"),
  organizationName: z.string().trim().min(2, "Nome da organização é obrigatório").max(100, "Nome muito longo")
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess: () => void;
  onLoginClick: () => void;
}

export function RegisterForm({ onSuccess, onLoginClick }: RegisterFormProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      organizationName: ""
    }
  });

  const inputClassName = "bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400";
  const labelClassName = "text-gray-700";

  const handleSubmit = async (values: RegisterFormValues) => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-free-account", {
        body: {
          email: values.email,
          organizationName: values.organizationName
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao criar conta");
      }

      onSuccess();
    } catch (error) {
      const description = error instanceof Error && error.message ? error.message : "Tente novamente em instantes.";
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description
      });
    } finally {
      setIsCreating(false);
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
                <Input {...field} type="email" disabled={isCreating} className={inputClassName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organizationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Nome da Organização</FormLabel>
              <FormControl>
                <Input {...field} disabled={isCreating} className={inputClassName} placeholder="Ex: Clínica São Lucas" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isCreating} className="w-full bg-[#273D60] hover:bg-[#1a2847] text-white">
          {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar Conta Gratuita
        </Button>

        <div className="flex flex-row items-center justify-center gap-x-4 pt-2">
          <button
            type="button"
            onClick={onLoginClick}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Já tenho conta
          </button>
        </div>
      </form>
    </Form>
  );
}
