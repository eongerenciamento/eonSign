import { File, Folder, BarChart, Settings } from "lucide-react";
import { DashboardIcon } from "@/components/icons/DashboardIcon";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserProfileSheet } from "@/components/UserProfileSheet";

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

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#273d60] flex items-center justify-center h-14 md:hidden border-none px-4 rounded-b-3xl shadow-lg">
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

        {/* Avatar para abrir o UserProfileSheet - centralizado verticalmente */}
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
      </nav>

      <UserProfileSheet 
        open={profileSheetOpen} 
        onOpenChange={setProfileSheetOpen} 
      />
    </>
  );
}
