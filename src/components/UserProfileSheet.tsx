import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatTelefone } from "@/lib/masks";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  StandardSheet,
  standardInputClass,
  standardLabelClass,
  standardFieldGroupClass,
} from "@/components/ui/standard-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Eye, EyeOff, LogOut, User as UserIcon } from "lucide-react";

interface UserProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileSheet({ open, onOpenChange }: UserProfileSheetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    cargo: "",
    organizacao: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Tentar buscar o perfil existente
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Se o perfil não existir, criar um novo automaticamente
      if (error && error.code === 'PGRST116') {
        const newProfile = {
          id: user.id,
          email: user.email || "",
          nome_completo: user.user_metadata?.nome_completo || user.user_metadata?.name || "",
        };

        const { data: createdProfile, error: insertError } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();

        if (insertError) {
          console.error("Erro ao criar perfil:", insertError);
          // Retornar um perfil mínimo com dados do auth
          return {
            id: user.id,
            email: user.email || "",
            nome_completo: "",
            telefone: null,
            cargo: null,
            organizacao: null,
            foto_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }

        return createdProfile;
      }

      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        nome_completo: profile.nome_completo || "",
        email: profile.email || "",
        telefone: profile.telefone || "",
        cargo: profile.cargo || "",
        organizacao: profile.organizacao || "",
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!profile?.id) throw new Error("Usuário não encontrado");

      const { error } = await supabase
        .from("profiles")
        .update({
          nome_completo: data.nome_completo,
          telefone: data.telefone,
          cargo: data.cargo,
          organizacao: data.organizacao,
        })
        .eq("id", profile.id);

      if (error) throw error;

      if (passwordData.newPassword) {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
          throw new Error("As senhas não coincidem");
        }
        if (passwordData.newPassword.length < 6) {
          throw new Error("A senha deve ter pelo menos 6 caracteres");
        }
        const { error: passwordError } = await supabase.auth.updateUser({
          password: passwordData.newPassword,
        });
        if (passwordError) throw passwordError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setPasswordData({ newPassword: "", confirmPassword: "" });
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error.message,
      });
    },
  });

  const handlePhotoUpload = async (file: File) => {
    if (!profile?.id) return;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      const publicUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ foto_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setLocalPhotoUrl(publicUrlWithCacheBust);
      await queryClient.refetchQueries({ queryKey: ["profile"] });

      toast({
        title: "Foto atualizada",
        description: "Sua foto de perfil foi atualizada com sucesso",
      });
    } catch (error: any) {
      console.error("Photo upload error:", error);
      toast({
        variant: "destructive",
        title: "Erro ao fazer upload",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: error.message,
      });
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value);
    setFormData({ ...formData, telefone: formatted });
  };

  return (
    <StandardSheet
      open={open}
      onOpenChange={onOpenChange}
      title={formData.nome_completo || "Usuário"}
      subtitle={formData.cargo}
      avatar={{
        src: localPhotoUrl || profile?.foto_url || "",
        alt: formData.nome_completo,
        fallback: <UserIcon className="h-5 w-5" />,
        onUpload: handlePhotoUpload,
      }}
      footer={
        <>
          <Button type="button" variant="sheet-cancel" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
          <Button
            type="button"
            variant="sheet-primary"
            onClick={() => updateProfileMutation.mutate(formData)}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </>
      }
    >
      <div className={standardFieldGroupClass}>
        <Label className={standardLabelClass}>Nome</Label>
        <Input
          className={standardInputClass}
          value={formData.nome_completo}
          onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
          required
        />
      </div>

      <div className={standardFieldGroupClass}>
        <Label className={standardLabelClass}>E-mail</Label>
        <Input className={standardInputClass} type="email" value={formData.email} disabled />
      </div>

      <div className={standardFieldGroupClass}>
        <Label className={standardLabelClass}>Telefone</Label>
        <Input
          className={standardInputClass}
          value={formData.telefone}
          onChange={handleTelefoneChange}
          placeholder="(00)00000-0000"
          inputMode="numeric"
        />
      </div>

      <div className={standardFieldGroupClass}>
        <Label className={standardLabelClass}>Cargo</Label>
        <Input
          className={standardInputClass}
          value={formData.cargo}
          onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
          placeholder="Ex: Gerente de Projetos"
        />
      </div>

      <div className={standardFieldGroupClass}>
        <Label className={standardLabelClass}>Organização</Label>
        <Input
          className={standardInputClass}
          value={formData.organizacao}
          onChange={(e) => setFormData({ ...formData, organizacao: e.target.value })}
          placeholder="Ex: Empresa XYZ"
        />
      </div>

      <div className="grid gap-3 rounded-2xl bg-muted/60 p-3">
        <div className={standardFieldGroupClass}>
          <Label className={standardLabelClass}>Nova senha</Label>
          <div className="relative">
            <Input
              className={`${standardInputClass} pr-10`}
              type={showNewPassword ? "text" : "password"}
              value={passwordData.newPassword}
              maxLength={72}
              placeholder="Digite a nova senha"
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className={standardFieldGroupClass}>
          <Label className={standardLabelClass}>Confirmar senha</Label>
          <div className="relative">
            <Input
              className={`${standardInputClass} pr-10`}
              type={showConfirmPassword ? "text" : "password"}
              value={passwordData.confirmPassword}
              maxLength={72}
              placeholder="Confirme a nova senha"
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </StandardSheet>
  );
}
