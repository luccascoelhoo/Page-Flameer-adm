import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";

// Layout & Auth
import AdminLayout from "@/components/admin/AdminLayout";
import AdminLogin from "@/pages/AdminLogin";
import NotFound from "@/pages/NotFound";

// Admin Pages
import Dashboard from "@/pages/admin/Dashboard";
import ChallengesList from "@/pages/admin/ChallengesList";
import ChallengeForm from "@/pages/admin/ChallengeForm";
import ChallengeParticipants from "@/pages/admin/ChallengeParticipants";
import WorkoutsList from "@/pages/admin/WorkoutsList";
import WorkoutAdaptations from "@/pages/admin/WorkoutAdaptations";
import DietsList from "@/pages/admin/DietsList";
import HabitTemplates from "@/pages/admin/HabitTemplates";
import UsersList from "@/pages/admin/UsersList";
import UserDetail from "@/pages/admin/UserDetail";
import CommunityModeration from "@/pages/admin/CommunityModeration";
import GamificationDashboard from "@/pages/admin/GamificationDashboard";
import AICopilot from "@/pages/admin/AICopilot";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
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
              <Route path="copilot" element={<AICopilot />} />
              
              {/* Challenges */}
              <Route path="challenges" element={<ChallengesList />} />
              <Route path="challenges/new" element={<ChallengeForm />} />
              <Route path="challenges/:id" element={<ChallengeForm />} />
              <Route path="challenges/:id/participants" element={<ChallengeParticipants />} />
              
              {/* Workouts */}
              <Route path="workouts" element={<WorkoutsList />} />
              <Route path="workouts/adaptations" element={<WorkoutAdaptations />} />
              
              {/* Diets */}
              <Route path="diets" element={<DietsList />} />
              
              {/* Habits */}
              <Route path="habits" element={<HabitTemplates />} />
              
              {/* Users */}
              <Route path="users" element={<UsersList />} />
              <Route path="users/:id" element={<UserDetail />} />
              
              {/* Community & Moderation */}
              <Route path="community" element={<CommunityModeration />} />
              
              {/* Gamification */}
              <Route path="gamification" element={<GamificationDashboard />} />
            </Route>

            {/* Catch All */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
