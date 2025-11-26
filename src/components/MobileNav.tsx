import { FileText, LayoutDashboard, FileBarChart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
];

export function MobileNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") return currentPath === path;
    return currentPath.startsWith(path);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border flex items-center justify-around h-16 md:hidden">
      {items.map((item) => (
        <NavLink
          key={item.url}
          to={item.url}
          end={item.url === "/"}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <item.icon
            className={`w-6 h-6 ${
              isActive(item.url) ? "text-primary" : ""
            }`}
          />
          <span
            className={`text-xs ${
              isActive(item.url) ? "text-primary font-medium" : ""
            }`}
          >
            {item.title}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
