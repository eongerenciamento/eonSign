import { File, Folder, BarChart, Menu, Settings } from "lucide-react";
import { DashboardIcon } from "@/components/icons/DashboardIcon";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserProfileSheet } from "@/components/UserProfileSheet";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import logoSign from "@/assets/logo-sign.png";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
const items = [{
  title: "Dashboard",
  url: "/",
  icon: DashboardIcon
}, {
  title: "Documentos",
  url: "/documentos",
  icon: File
}, {
  title: "Drive",
  url: "/drive",
  icon: Folder
}, {
  title: "Relatórios",
  url: "/relatorios",
  icon: BarChart
}, {
  title: "Configurações",
  url: "/configuracoes",
  icon: Settings
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [pendingDocuments, setPendingDocuments] = useState(0);
  const [supportTickets, setSupportTickets] = useState(0);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  useEffect(() => {
    const loadUserData = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        setName(user.user_metadata?.name || "");
        setOrganization(user.user_metadata?.organization || "");
        setAvatarUrl(user.user_metadata?.avatar_url || null);

        // Buscar documentos pendentes
        const {
          count
        } = await supabase.from('documents').select('*', {
          count: 'exact',
          head: true
        }).eq('user_id', user.id).eq('status', 'pending');
        setPendingDocuments(count || 0);

        // Placeholder para tickets de suporte (será implementado futuramente)
        setSupportTickets(0);
      }
    };
    loadUserData();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setName(session.user.user_metadata?.name || "");
        setOrganization(session.user.user_metadata?.organization || "");
        setAvatarUrl(session.user.user_metadata?.avatar_url || null);
      }
    });

    // Realtime subscription para documentos
    const documentsChannel = supabase.channel('documents-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'documents'
    }, async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        const {
          count
        } = await supabase.from('documents').select('*', {
          count: 'exact',
          head: true
        }).eq('user_id', user.id).eq('status', 'pending');
        setPendingDocuments(count || 0);
      }
    }).subscribe();
    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(documentsChannel);
    };
  }, []);
  const isActive = (path: string) => {
    if (path === "/") return currentPath === path;
    return currentPath.startsWith(path);
  };
  const getUserInitials = () => {
    if (name) return name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "U";
  };
  return <Sidebar className={`${collapsed ? "w-16" : "w-64"} bg-gradient-to-b from-[#273d60] to-[#001a4d]`} collapsible="icon">
      {/* Header com Toggle */}
      <div className={`${collapsed ? "px-3 py-4" : "p-6"} flex flex-col items-center`}>
        <SidebarTrigger className={`text-white hover:bg-white/10 ${collapsed ? "mx-auto" : "self-end"}`}>
          <Menu className="w-5 h-5" />
        </SidebarTrigger>
        
        {!collapsed && <div className="mt-6 flex justify-center w-full">
            <img src={logoSign} alt="Éon Sign" className="h-19 w-auto object-contain" />
          </div>}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <TooltipProvider>
              <SidebarMenu>
                {items.map(item => {
                const showBadge = item.title === "Documentos" && pendingDocuments > 0 || item.title === "Configurações" && supportTickets > 0;
                const badgeCount = item.title === "Documentos" ? pendingDocuments : supportTickets;
                const menuButton = <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-3 hover:bg-white/10 text-white data-[active=true]:bg-white/20">
                        <item.icon className="w-5 h-5" />
                        {!collapsed && <span className="flex items-center gap-2 flex-1 font-sans font-light text-sm">
                            {item.title}
                            {showBadge && <Badge variant="destructive" className="ml-auto h-5 px-2 text-xs bg-red-500 text-white">
                                {badgeCount}
                              </Badge>}
                          </span>}
                        {collapsed && showBadge && <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </Badge>}
                      </NavLink>
                    </SidebarMenuButton>;
                return <SidebarMenuItem key={item.title}>
                      {collapsed ? <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            {menuButton}
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-[#273d60] text-white border-white/20">
                            {item.title}
                          </TooltipContent>
                        </Tooltip> : menuButton}
                    </SidebarMenuItem>;
              })}
              </SidebarMenu>
            </TooltipProvider>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <div className="p-4 mt-auto">
        {!collapsed ? <button onClick={() => setProfileSheetOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-colors">
            <Avatar className="h-10 w-10">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="bg-white/20 text-white">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">
                {name || user?.email || "Usuário"}
              </p>
              <p className="text-xs text-white/60 truncate">
                {organization || "Organização"}
              </p>
              <p className="text-xs text-white/40">
                Administrador
              </p>
            </div>
          </button> : <button onClick={() => setProfileSheetOpen(true)} className="w-full flex items-center justify-center p-2 rounded-lg text-white hover:bg-white/10 transition-colors" title="Perfil">
            <Avatar className="h-10 w-10">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="bg-white/20 text-white">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </button>}
      </div>

      <UserProfileSheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen} userName={name} userEmail={user?.email || ""} userAvatar={avatarUrl} organization={organization} onAvatarChange={setAvatarUrl} />
    </Sidebar>;
}