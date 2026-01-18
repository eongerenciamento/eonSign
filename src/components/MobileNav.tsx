import { File, Folder, BarChart, Settings } from "lucide-react";
import { DashboardIcon } from "@/components/icons/DashboardIcon";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserProfileSheet } from "@/components/UserProfileSheet";
import { useTheme } from "next-themes";

const items = [
  { title: "Dashboard", url: "/", icon: DashboardIcon },
  { title: "Documentos", url: "/documentos", icon: File },
  { title: "Drive", url: "/drive", icon: Folder },
  { title: "Relatórios", url: "/relatorios", icon: BarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function MobileNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      return data;
    },
  });

  const isActive = (path: string) => {
    if (path === "/") return currentPath === path;
    return currentPath.startsWith(path);
  };

  const getUserInitials = () => {
    if (profile?.nome_completo) return profile.nome_completo.charAt(0).toUpperCase();
    if (profile?.email) return profile.email.charAt(0).toUpperCase();
    return "U";
  };

  const navBackground = resolvedTheme === 'dark' 
    ? 'hsla(220, 10%, 18%, 0.65)' 
    : 'linear-gradient(to right, rgba(15, 30, 65, 0.65) 0%, rgba(30, 58, 110, 0.65) 100%)';

  return (
    <>
      {/* Container fixo no topo */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden">
        {/* Safe area para notch/dynamic island */}
        <div 
          className="bg-background"
          style={{ height: 'env(safe-area-inset-top, 0px)' }}
        />
        
        {/* Nav flutuante com glassmorphism */}
        <nav 
          className="mx-3 mt-2 rounded-full backdrop-blur-xl border border-white/10"
          style={{ background: navBackground }}
        >
          <div className="px-3 py-3 flex items-center justify-center">
            {/* Ícones de navegação centralizados */}
            <div className="flex items-center justify-center gap-2 flex-1">
              {items.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  className={`flex items-center justify-center px-3 py-2 rounded-lg transition-colors hover:bg-white/10 ${
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

            {/* Avatar para abrir o UserProfileSheet */}
            <button 
              className="flex-shrink-0"
              onClick={() => setProfileSheetOpen(true)}
            >
              <Avatar className="h-8 w-8 border-2 border-white/20">
                {profile?.foto_url && <AvatarImage src={profile.foto_url} />}
                <AvatarFallback className="bg-gray-200 text-gray-600">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </nav>
      </div>

      {/* Spacer para evitar que conteúdo fique escondido */}
      <div 
        className="md:hidden"
        style={{ 
          height: 'calc(env(safe-area-inset-top, 0px) + 68px)',
          paddingTop: 'env(safe-area-inset-top, 0px)'
        }}
      />

      <UserProfileSheet 
        open={profileSheetOpen} 
        onOpenChange={setProfileSheetOpen} 
      />
    </>
  );
}
