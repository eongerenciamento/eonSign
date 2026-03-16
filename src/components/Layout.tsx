import { SidebarProvider } from "@/components/ui/sidebar";
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
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background">
      {/* Mobile Navigation */}
      <MobileNav />

      {/* Desktop Layout with Sidebar */}
      <SidebarProvider defaultOpen={false}>
        <div
          className="flex flex-1 h-screen w-full overflow-hidden"
          style={{ background: "var(--gradient-sidebar)" }}
        >
          {/* Desktop Sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto md:m-3 bg-gray-100 dark:bg-background md:rounded-2xl md:shadow-lg">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};