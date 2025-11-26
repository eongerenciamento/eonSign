import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <>
      {/* Mobile Navigation */}
      <MobileNav />

      {/* Desktop Layout with Sidebar */}
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          {/* Desktop Sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col w-full">
            {/* Desktop Header with Toggle */}
            <header className="hidden md:flex h-14 items-center border-b border-border px-4">
              <SidebarTrigger />
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-auto pt-16 md:pt-0">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
};
