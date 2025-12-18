import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { useWhatsAppFailureNotifications } from "@/hooks/useWhatsAppFailureNotifications";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  // Monitor WhatsApp failures in real-time
  useWhatsAppFailureNotifications();

  return (
    <>
      {/* Mobile Navigation */}
      <MobileNav />

      {/* Desktop Layout with Sidebar */}
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full">
          {/* Desktop Sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col w-full bg-gradient-to-b from-[#273d60] to-[#0a1628]">
            {/* Content Area */}
            <main className="flex-1 overflow-auto pt-16 md:pt-4 md:pb-4 md:pr-4">
              <div className="bg-white md:rounded-2xl min-h-full overflow-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
};
