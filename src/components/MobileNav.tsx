import { File, Folder, BarChart, LogOut, Settings, Camera, X } from "lucide-react";
import { DashboardIcon } from "@/components/icons/DashboardIcon";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";


const items = [
  { title: "Dashboard", url: "/", icon: DashboardIcon },
  { title: "Documentos", url: "/documentos", icon: File },
  { title: "Drive", url: "/drive", icon: Folder },
  { title: "Relatórios", url: "/relatorios", icon: BarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [user, setUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        setEmail(user.email || "");
        setName(user.user_metadata?.name || "");
        setOrganization(user.user_metadata?.organization || "");
        setAvatarUrl(user.user_metadata?.avatar_url || null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setEmail(session.user.email || "");
          setName(session.user.user_metadata?.name || "");
          setOrganization(session.user.user_metadata?.organization || "");
          setAvatarUrl(session.user.user_metadata?.avatar_url || null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return currentPath === path;
    return currentPath.startsWith(path);
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
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "U";
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      toast.success("Avatar atualizado");
    } catch (error) {
      toast.error("Erro ao fazer upload do avatar");
    }
  };

  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name,
          organization,
          avatar_url: avatarUrl
        }
      });

      if (error) throw error;

      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (passwordError) throw passwordError;
      }

      toast.success("Perfil atualizado com sucesso");
      setSheetOpen(false);
      setNewPassword("");
    } catch (error) {
      toast.error("Erro ao atualizar perfil");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-layout-gradient flex items-center justify-center h-16 pt-safe md:hidden border-none px-3">

      {/* Ícones de navegação centralizados */}
      <div className="flex items-center justify-center gap-2 flex-1">
        {items.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className={`flex items-center justify-center h-full px-3 py-2 rounded-lg transition-colors ${
              isActive(item.url) ? "bg-white/20" : ""
            }`}
          >
            <item.icon
              className="w-5 h-5 text-white"
              strokeWidth={1.5}
            />
          </NavLink>
        ))}
      </div>

      {/* Avatar com Sheet para edição de informações */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <button className="flex-shrink-0">
            <Avatar className="h-8 w-8 border-2 border-white/20">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="bg-white/50 text-sidebar-background">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[320px] overflow-y-auto bg-card">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-card-foreground">Perfil do Usuário</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-6">
            {/* Avatar com botão de upload */}
            <div className="flex justify-end">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  {avatarUrl && <AvatarImage src={avatarUrl} />}
                  <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4 text-primary-foreground" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Campos do formulário */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-card-foreground">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-input border-border text-card-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-card-foreground">E-mail</Label>
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization" className="text-card-foreground">Organização</Label>
                <Input
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Nome da organização"
                  className="bg-input border-border text-card-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-card-foreground">Alterar Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (opcional)"
                  className="bg-input border-border text-card-foreground"
                />
              </div>
            </div>

            {/* Botões de ação */}
            <div className="space-y-3 pt-4">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={() => setSheetOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </nav>
  );
}
