import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Upload, LogOut } from "lucide-react";
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
}

export function UserProfileSheet({
  open,
  onOpenChange,
  userName,
  userEmail,
  userAvatar,
  organization,
  onAvatarChange,
}: UserProfileSheetProps) {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(userName);
  const [role, setRole] = useState("Administrador");
  const [email, setEmail] = useState(userEmail);
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState(userAvatar);

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAvatar = reader.result as string;
        setAvatar(newAvatar);
        onAvatarChange(newAvatar);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase.auth.updateUser({
      data: {
        name,
        avatar_url: avatar,
        organization,
      },
    });

    if (error) {
      toast.error("Erro ao salvar alterações");
    } else {
      toast.success("Alterações salvas com sucesso!");
      onOpenChange(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      toast.success("Logout realizado");
      navigate("/auth");
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
            <SheetTitle className="text-2xl font-bold text-gray-700">
              Editar Perfil
            </SheetTitle>
            <div className="relative">
              <Avatar className="h-16 w-16">
                {avatar && <AvatarImage src={avatar} />}
                <AvatarFallback className="bg-gradient-to-br from-[#274d60] to-[#001a4d] text-white text-xl">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#274d60] to-[#001a4d] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
              >
                <Upload className="w-4 h-4" />
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
              className="text-base"
              placeholder="Digite seu nome"
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
              className="text-base"
              placeholder="Digite seu cargo"
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
              className="text-base"
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
              className="text-base"
              placeholder="(00)00000-0000"
              maxLength={14}
            />
          </div>

          <Button
            variant="outline"
            className="w-full justify-start text-gray-600 border-gray-300"
            onClick={() => navigate("/configuracoes")}
          >
            <Lock className="w-4 h-4 mr-2" />
            Alterar senha
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <Button
            className="bg-gradient-to-r from-[#274d60] to-[#001a4d] text-white hover:opacity-90"
            onClick={handleSave}
          >
            Salvar Alterações
          </Button>
          <Button
            className="bg-gradient-to-r from-[#274d60] to-[#001a4d] text-white hover:opacity-90"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
