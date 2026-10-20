import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { ConfirmarProvider } from "@/components/admin/Confirmar";

// Layout & Auth
import AdminLayout from "@/components/admin/AdminLayout";
import AdminLogin from "@/pages/AdminLogin";
import NotFound from "@/pages/NotFound";

// Admin Pages
import Dashboard from "@/pages/admin/Dashboard";
import Intelligence from "@/pages/admin/Intelligence";
import UsoDoApp from "@/pages/admin/UsoDoApp";
import Comportamento from "@/pages/admin/Comportamento";
import Metabolism from "@/pages/admin/Metabolism";
import HealthBoard from "@/pages/admin/HealthBoard";
import AuditLog from "@/pages/admin/AuditLog";
import RequireAdmin from "@/components/admin/RequireAdmin";
import ChallengesList from "@/pages/admin/ChallengesList";
import ChallengeForm from "@/pages/admin/ChallengeForm";
import ChallengeParticipants from "@/pages/admin/ChallengeParticipants";
import WorkoutsList from "@/pages/admin/WorkoutsList";
import BibliotecaDeExercicios from "@/pages/admin/BibliotecaDeExercicios";
import WorkoutAdaptations from "@/pages/admin/WorkoutAdaptations";
import DietsList from "@/pages/admin/DietsList";
import BibliotecaDeAlimentos from "@/pages/admin/BibliotecaDeAlimentos";
import HabitTemplates from "@/pages/admin/HabitTemplates";
import UsersList from "@/pages/admin/UsersList";
import UserDetail from "@/pages/admin/UserDetail";
import RelatorioDeGrupo from "@/pages/admin/RelatorioDeGrupo";
import CommunityModeration from "@/pages/admin/CommunityModeration";
import FeedDaComunidade from "@/pages/admin/FeedDaComunidade";
import GamificationDashboard from "@/pages/admin/GamificationDashboard";
import ChurnDashboard from "@/pages/admin/ChurnDashboard";
import RegrasDePontos from "@/pages/admin/RegrasDePontos";
import AICopilot from "@/pages/admin/AICopilot";
import ReferralCodes from "@/pages/admin/ReferralCodes";
import CodigosDeAcesso from "@/pages/admin/CodigosDeAcesso";
import Pagamentos from "@/pages/admin/Pagamentos";
import Settings from "@/pages/admin/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ConfirmarProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login Route */}
            <Route path="/login" element={<AdminLogin />} />

            {/* Protected Admin Routes */}
            <Route path="/" element={<AdminLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="intelligence" element={<Intelligence />} />
              <Route path="uso" element={<UsoDoApp />} />
              <Route path="comportamento" element={<Comportamento />} />
              <Route path="health" element={<HealthBoard />} />
              <Route path="copilot" element={<AICopilot />} />
              
              {/* Challenges */}
              <Route path="challenges" element={<ChallengesList />} />
              <Route path="challenges/new" element={<ChallengeForm />} />
              <Route path="challenges/:id" element={<ChallengeForm />} />
              <Route path="challenges/:id/participants" element={<ChallengeParticipants />} />
              
              {/* Workouts */}
              <Route path="workouts" element={<WorkoutsList />} />
              <Route path="exercicios" element={<BibliotecaDeExercicios />} />
              <Route path="workouts/adaptations" element={<WorkoutAdaptations />} />
              
              {/* Diets */}
              <Route path="diets" element={<DietsList />} />
              <Route path="alimentos" element={<BibliotecaDeAlimentos />} />

              {/* Professional tools */}
              <Route path="tools/metabolism" element={<Metabolism />} />
              
              {/* Habits */}
              <Route path="habits" element={<HabitTemplates />} />
              
              {/* Users */}
              <Route path="users" element={<UsersList />} />
              <Route path="users/relatorio" element={<RelatorioDeGrupo />} />
              <Route path="users/:id" element={<UserDetail />} />
              
              {/* Community & Moderation */}
              <Route path="community" element={<CommunityModeration />} />
              <Route path="feed" element={<FeedDaComunidade />} />
              
              {/* Gamification */}
              <Route path="churn" element={<ChurnDashboard />} />
              <Route path="gamification" element={<GamificationDashboard />} />
              <Route path="gamification/pontos" element={<RegrasDePontos />} />

              {/* Admin-only surfaces */}
              <Route path="referrals" element={<RequireAdmin><ReferralCodes /></RequireAdmin>} />
              <Route path="pagamentos" element={<RequireAdmin><Pagamentos /></RequireAdmin>} />
              <Route path="codigos" element={<RequireAdmin><CodigosDeAcesso /></RequireAdmin>} />
              <Route path="settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
              <Route path="audit" element={<RequireAdmin><AuditLog /></RequireAdmin>} />
            </Route>

            {/* Catch All */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ConfirmarProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
