import { FileText, FileBarChart, LogOut, Settings } from "lucide-react";
import { DashboardIcon } from "@/components/icons/DashboardIcon";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import logoEon from "@/assets/logo-eon.png";

const items = [
  { title: "Dashboard", url: "/", icon: DashboardIcon },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [user, setUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
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
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#273d60] flex items-center justify-between h-16 pt-safe md:hidden border-none px-3">
      {/* Logo no canto esquerdo */}
      <div className="flex-shrink-0">
        <img src={logoEon} alt="Éon Logo" className="h-8 w-auto" />
      </div>

      {/* Ícones de navegação centralizados */}
      <div className="flex items-center justify-center gap-2 flex-1">
        {items.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center justify-center h-full px-2 transition-colors"
          >
            <item.icon
              className={`w-5 h-5 ${
                isActive(item.url) ? "text-primary" : "text-white"
              }`}
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
              <AvatarFallback className="bg-white/50 text-[#273d60]">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px]">
          <SheetHeader>
            <SheetTitle>Perfil do Usuário</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center gap-4 pb-4 border-b">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-white/50 text-[#273d60] text-2xl">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Usuário</p>
              </div>
            </div>

            {/* Botão de Logout */}
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair do Sistema
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
