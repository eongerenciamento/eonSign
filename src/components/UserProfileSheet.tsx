import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, LogOut, Check, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface UserProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  organization: string;
  onAvatarChange: (url: string) => void;
  onProfileUpdate?: () => void;
}

export function UserProfileSheet({
  open,
  onOpenChange,
  userName,
  userEmail,
  userAvatar,
  organization,
  onAvatarChange,
  onProfileUpdate,
}: UserProfileSheetProps) {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(userName);
  const [role, setRole] = useState("Administrador");
  const [email, setEmail] = useState(userEmail);
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState(userAvatar);
  const [organizationName, setOrganizationName] = useState(organization);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sincronizar estados quando as props mudarem
  useEffect(() => {
    setName(userName);
    setEmail(userEmail);
    setAvatar(userAvatar);
    setOrganizationName(organization);
  }, [userName, userEmail, userAvatar, organization, open]);

  // Carregar telefone do company_settings
  useEffect(() => {
    const loadPhone = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('company_settings')
          .select('admin_phone')
          .eq('user_id', user.id)
          .single();
        
        if (data?.admin_phone) {
          setPhone(data.admin_phone);
        }
      }
    };
    if (open) {
      loadPhone();
    }
  }, [open]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)})${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)})${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatar(publicUrl);
      onAvatarChange(publicUrl);
      toast.success("Avatar atualizado!");
    } catch (error) {
      toast.error("Erro ao fazer upload do avatar");
    }
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Se estiver alterando senha, validar e atualizar
    if (showPasswordFields) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error("Preencha todos os campos de senha");
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error("A nova senha e a confirmação não coincidem");
        return;
      }

      if (newPassword.length < 6) {
        toast.error("A nova senha deve ter no mínimo 6 caracteres");
        return;
      }

      // Atualizar senha
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) {
        toast.error("Erro ao alterar senha: " + passwordError.message);
        return;
      }

      toast.success("Senha alterada com sucesso!");
      setShowPasswordFields(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    // Atualizar dados do perfil no user_metadata
    const { error } = await supabase.auth.updateUser({
      data: {
        name,
        avatar_url: avatar,
        organization: organizationName,
      },
    });

    if (error) {
      toast.error("Erro ao salvar alterações");
      return;
    }

    // Atualizar company_settings (avatar_url para o avatar do usuário)
    const { error: companyError } = await supabase
      .from('company_settings')
      .update({
        admin_name: name,
        admin_phone: phone,
        admin_email: email,
        avatar_url: avatar,
      })
      .eq('user_id', user.id);

    if (companyError) {
      toast.error("Erro ao atualizar configurações da empresa");
      return;
    }

    // Atualizar callback com nova URL do avatar
    if (avatar) {
      onAvatarChange(avatar);
    }
    
    // Notificar o parent para atualizar dados
    if (onProfileUpdate) {
      onProfileUpdate();
    }

    toast.success("Alterações salvas com sucesso!");
    onOpenChange(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      toast.custom(() => (
        <div className="flex items-center justify-start">
          <LogOut
            className="h-6 w-6 text-muted-foreground animate-[slide-out-right_0.8s_ease-in-out_forwards]"
            strokeWidth={2.5}
          />
        </div>
      ), {
        duration: 1500,
        position: "top-left",
        unstyled: true,
        className: "!bg-transparent !border-0 !shadow-none !p-0",
      });
      setTimeout(() => navigate("/auth"), 800);
    }
  };

  const getUserInitials = () => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return "U";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-8">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm text-gray-600 text-left">
              Perfil do Usuário
            </SheetTitle>
            <div className="relative">
              <Avatar className="h-12 w-12">
                {avatar && <AvatarImage src={avatar} />}
                <AvatarFallback className={avatar ? "bg-[#273D60] text-white text-base" : "bg-gray-200 text-gray-600 text-base"}>
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#273D60] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
              >
                <Upload className="w-3 h-3" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-600">
              Nome
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base bg-gray-100 border-none"
              placeholder="Digite seu nome"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-600">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-base bg-gray-100 border-none"
              placeholder="Digite seu e-mail"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-600">
              Telefone
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="text-base bg-gray-100 border-none"
              placeholder="(00)00000-0000"
              maxLength={14}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-gray-600">
              Cargo
            </Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="text-base bg-gray-100 border-none"
              placeholder="Ex: Gerente de Projetos"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization" className="text-gray-600">
              Organização
            </Label>
            <Input
              id="organization"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="text-base bg-gray-100 border-none"
              placeholder="Ex: Empresa XYZ"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswordFields(!showPasswordFields)}
            className="text-gray-600 text-sm hover:text-gray-800 transition-colors"
          >
            Alterar Senha
          </button>

          {showPasswordFields && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-gray-600">
                  Senha Atual
                </Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="text-base pr-10 bg-gray-100 border-none"
                    placeholder="Digite sua senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-gray-600">
                  Nova Senha
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="text-base pr-10 bg-gray-100 border-none"
                    placeholder="Digite sua nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-600">
                  Confirmação de Senha
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-base pr-10 bg-gray-100 border-none"
                    placeholder="Confirme sua nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-8 mt-8">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
          
          <Button
            onClick={handleSave}
            className="bg-gray-200 text-gray-600 hover:bg-gray-300 px-8"
          >
            <Check className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
