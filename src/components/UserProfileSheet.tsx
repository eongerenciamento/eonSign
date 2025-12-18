import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatTelefone } from "@/lib/masks";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, LogOut, Check, Eye, EyeOff } from "lucide-react";

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
  const [showPasswordFields, setShowPasswordFields] = useState(false);
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile?.id) return;
    
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      console.log("Uploading photo for user:", profile.id);
      
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      // Add cache-busting timestamp to prevent browser caching
      const publicUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      
      console.log("Upload successful, updating profile with URL:", publicUrlWithCacheBust);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ foto_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      // Update local state immediately for instant UI feedback
      setLocalPhotoUrl(publicUrlWithCacheBust);

      // Force immediate refetch of profile data
      await queryClient.refetchQueries({ queryKey: ["profile"] });
      
      console.log("Photo update complete");
      
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

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Senha alterada",
        description: "Sua senha foi atualizada com sucesso",
      });

      setShowPasswordFields(false);
      setPasswordData({ newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar senha",
        description: error.message,
      });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        description: <LogOut className="h-5 w-5 mx-auto animate-[scale-in_0.3s_ease-out]" strokeWidth={2.5} />,
        className: "bg-gray-500 text-white border-none justify-center p-2 min-h-0 w-10 h-10 rounded-full",
        duration: 1500
      });
      navigate("/auth");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: error.message,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value);
    setFormData({ ...formData, telefone: formatted });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto sm:rounded-l-2xl border-l">
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-muted-foreground">Perfil do Usuário</span>
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={localPhotoUrl || profile?.foto_url || ""} />
              <AvatarFallback 
                className="text-lg font-medium bg-gray-200 text-gray-600"
              >
                {profile?.nome_completo?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            
            <Label 
              htmlFor="photo-upload" 
              className="absolute -bottom-1 -right-1 cursor-pointer rounded-full p-1.5 hover:opacity-90 transition-opacity bg-transparent"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-3 w-3 text-muted-foreground" />
              )}
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </Label>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-2">
            <Label htmlFor="nome_completo">Nome</Label>
            <Input
              id="nome_completo"
              value={formData.nome_completo}
              onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
              required
              className="bg-muted border-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-muted border-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={handleTelefoneChange}
              placeholder="(00)00000-0000"
              inputMode="numeric"
              className="bg-muted border-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              value={formData.cargo}
              onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
              placeholder="Ex: Gerente de Projetos"
              className="bg-muted border-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizacao">Organização</Label>
            <Input
              id="organizacao"
              value={formData.organizacao}
              onChange={(e) => setFormData({ ...formData, organizacao: e.target.value })}
              placeholder="Ex: Empresa XYZ"
              className="bg-muted border-0"
            />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              className="w-full text-left text-sm text-muted-foreground bg-transparent border-0 p-0 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setShowPasswordFields(!showPasswordFields)}
            >
              Alterar Senha
            </button>
            
            {showPasswordFields && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      placeholder="Digite a nova senha"
                      className="bg-muted border-0 pr-10"
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      placeholder="Confirme a nova senha"
                      className="bg-muted border-0 pr-10"
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

                <Button
                  type="button"
                  onClick={handlePasswordChange}
                  className="w-full rounded-full bg-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-600"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar Alteração
                </Button>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 rounded-full text-gray-600 hover:bg-transparent hover:text-gray-600"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-600"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
