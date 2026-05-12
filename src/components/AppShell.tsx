import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  FolderTree,
  History,
  BarChart3,
  Bell,
  Moon,
  Sun,
  Stethoscope,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Importar PDF", icon: Upload },
  { to: "/groups", label: "Áreas", icon: FolderTree },
  { to: "/history", label: "Histórico", icon: History },
  { to: "/stats", label: "Desempenho", icon: BarChart3 },
  { to: "/reminders", label: "Lembretes", icon: Bell },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { darkMode, toggleDark } = useStore();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Stethoscope className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">MedQuiz</div>
            <div className="text-xs text-muted-foreground">Estude de forma inteligente</div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={toggleDark}
          className="m-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {darkMode ? "Modo claro" : "Modo escuro"}
        </button>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
