import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import SchoolDashboard from "./pages/school/SchoolDashboard";
import SchoolYearsSections from "./pages/school/SchoolYearsSections";
import SchoolsList from "./pages/admin/SchoolsList";
import SchoolForm from "./pages/admin/SchoolForm";
import UsersList from "./pages/admin/UsersList";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/school/dashboard" 
              element={
                <ProtectedRoute requiredRole="school">
                  <SchoolDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/school/configuraciones/anos-secciones" 
              element={
                <ProtectedRoute requiredRole="school">
                  <SchoolYearsSections />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/colegios" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <SchoolsList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/colegios/crear" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <SchoolForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/colegios/:id/editar" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <SchoolForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/usuarios" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <UsersList />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
