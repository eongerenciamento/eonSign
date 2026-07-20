import { File, Folder, BarChart, Settings, Menu } from "lucide-react";
import { DashboardIcon } from "@/components/icons/DashboardIcon";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserProfileSheet } from "@/components/UserProfileSheet";

const items = [
  { title: "Dashboard", url: "/", icon: DashboardIcon },
  { title: "Documentos", url: "/documentos", icon: File },
  { title: "Drive", url: "/drive", icon: Folder },
  { title: "Relatórios", url: "/relatorios", icon: BarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const glassBtn =
  "pointer-events-auto h-12 w-12 shrink-0 rounded-full border-0 bg-white/40 dark:bg-white/10 backdrop-blur-md backdrop-saturate-150 ring-1 ring-white/30 shadow-xl text-gray-700 hover:bg-white/55 hover:text-gray-700";

export function MobileNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
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

  const getShortName = () => {
    const fullName = profile?.nome_completo?.trim();
    if (!fullName) return profile?.email || "Usuário";
    const parts = fullName.split(/\s+/);
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]}`;
  };

  return (
    <>
      {/* Floating action button */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-center gap-3 md:hidden">
        <button
          type="button"
          className={glassBtn}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
        >
          <Menu className="mx-auto h-4 w-4" />
        </button>
      </div>

      {/* Floating navigation panel */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 animate-in fade-in-0 duration-100 bg-foreground/40"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <div
            className="fixed right-4 w-72 max-w-[calc(100vw-2.5rem)] animate-in slide-in-from-right-8 duration-300 ease-out will-change-transform"
            style={{
              top: "max(1rem, env(safe-area-inset-top))",
              height: "calc(100dvh - max(1rem, env(safe-area-inset-top)) - 6rem)",
            }}
          >
            <aside className="flex h-full flex-col overflow-hidden rounded-2xl bg-white/95 p-4 text-gray-800 shadow-2xl">
              <div className="flex items-center justify-center pb-4 pt-2">
                <div
                  role="img"
                  aria-label="Éon Sign"
                  className="h-14 w-48"
                  style={{
                    backgroundColor: "hsl(var(--sidebar-background))",
                    WebkitMaskImage: "url(/lovable-uploads/cf697ca1-b048-4c88-8e66-1659b20e2d9e.png)",
                    maskImage: "url(/lovable-uploads/cf697ca1-b048-4c88-8e66-1659b20e2d9e.png)",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
              </div>

              <nav className="flex-1 space-y-0.5 overflow-y-auto pt-0">
                {items.map((item) => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === "/"}
                    onClick={() => setMenuOpen(false)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-light text-gray-800 transition hover:bg-gray-300/50 hover:text-gray-900 ${
                      isActive(item.url) ? "bg-gray-300/50" : ""
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span>{item.title}</span>
                  </NavLink>
                ))}
              </nav>

              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-gray-300/40"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileSheetOpen(true);
                }}
              >
                <Avatar className="h-12 w-12 border-0 bg-muted text-foreground shadow-md">
                  {profile?.foto_url && <AvatarImage src={profile.foto_url} />}
                  <AvatarFallback className="bg-muted text-sm font-bold text-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-800">{getShortName()}</p>
                  <p className="truncate text-xs text-gray-600">{profile?.organizacao || ""}</p>
                  <p className="truncate text-xs text-gray-500">{profile?.cargo || ""}</p>
                </div>
              </button>
            </aside>
          </div>
        </div>
      )}

      <UserProfileSheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen} />
    </>
  );
}
