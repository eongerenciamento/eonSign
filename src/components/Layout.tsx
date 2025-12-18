import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { useWhatsAppFailureNotifications } from "@/hooks/useWhatsAppFailureNotifications";
interface LayoutProps {
  children: React.ReactNode;
}
export const Layout = ({
  children
}: LayoutProps) => {
  // Monitor WhatsApp failures in real-time
  useWhatsAppFailureNotifications();
  return <>
      {/* Fundo contrastante para mostrar bordas arredondadas do menu mobile */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-card z-40 md:hidden" />
      
      {/* Mobile Navigation */}
      <MobileNav className="rounded-2xl" />

      {/* Desktop Layout with Sidebar */}
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full">
          {/* Desktop Sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col w-full bg-layout-gradient">
            {/* Content Area */}
            <main className="flex-1 overflow-auto pt-16 md:pt-4 md:pb-4 md:pr-4">
              <div className="bg-card md:rounded-2xl min-h-full overflow-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>;
};