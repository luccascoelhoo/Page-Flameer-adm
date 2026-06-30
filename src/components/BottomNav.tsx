import { Home, Trophy, Users, Dumbbell, Utensils, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Minimal bottom navigation – icon-only.
 */
const tabs = [
  { icon: Home, label: "Inicial", path: "/home" },
  { icon: Dumbbell, label: "Treino", path: "/treino" },
  { icon: Utensils, label: "Dieta", path: "/dieta" },
  { icon: Trophy, label: "Desafio", path: "/desafio" },
  { icon: Users, label: "Comunidade", path: "/comunidade" },
  { icon: User, label: "Perfil", path: "/perfil" },
] as const;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/60">
      <div className="max-w-lg mx-auto flex items-center justify-around px-1 py-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-2xl transition-colors",
                isActive && "bg-primary/10"
              )}
            >
              <Icon
                size={26}
                strokeWidth={isActive ? 2.6 : 2.2}
                className={cn(
                  "transition-colors",
                  isActive ? "text-primary" : "text-foreground"
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
