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
import FormBuilder from "./pages/school/FormBuilder";
import FormFieldsEditor from "./pages/school/FormFieldsEditor";
import FamiliesList from "./pages/school/FamiliesList";
import EditFamily from "./pages/school/EditFamily";
import AddStudent from "./pages/school/AddStudent";
import AddRepresentative from "./pages/school/AddRepresentative";
import AdvancedSearch from "./pages/school/AdvancedSearch";
import TeachersList from "./pages/school/TeachersList";
import AddTeacher from "./pages/school/AddTeacher";
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
              path="/school/configuraciones/formularios" 
              element={
                <ProtectedRoute requiredRole="school">
                  <FormBuilder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/school/configuraciones/formularios/:type" 
              element={
                <ProtectedRoute requiredRole="school">
                  <FormFieldsEditor />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/familias" 
              element={
                <ProtectedRoute requiredRole="school">
                  <FamiliesList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/busqueda-avanzada" 
              element={
                <ProtectedRoute requiredRole="school">
                  <AdvancedSearch />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/docentes" 
              element={
                <ProtectedRoute requiredRole="school">
                  <TeachersList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/docentes/nuevo" 
              element={
                <ProtectedRoute requiredRole="school">
                  <AddTeacher />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/docentes/:teacherId/editar" 
              element={
                <ProtectedRoute requiredRole="school">
                  <AddTeacher />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/familias/:familyId/editar"
              element={
                <ProtectedRoute requiredRole="school">
                  <EditFamily />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/familias/:familyId/estudiante/nuevo" 
              element={
                <ProtectedRoute requiredRole="school">
                  <AddStudent />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/familias/:familyId/estudiante/:studentId/editar" 
              element={
                <ProtectedRoute requiredRole="school">
                  <AddStudent />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/familias/:familyId/representante/nuevo" 
              element={
                <ProtectedRoute requiredRole="school">
                  <AddRepresentative />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/familias/:familyId/representante/:representativeId/editar" 
              element={
                <ProtectedRoute requiredRole="school">
                  <AddRepresentative />
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
