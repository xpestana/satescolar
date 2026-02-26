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
import SubjectsList from "./pages/school/SubjectsList";
import SubjectAssignments from "./pages/school/SubjectAssignments";
import TeachersList from "./pages/school/TeachersList";
import AddTeacher from "./pages/school/AddTeacher";
import EnrollmentsList from "./pages/school/EnrollmentsList";
import EnrollmentDisplayConfig from "./pages/school/EnrollmentDisplayConfig";
import UtilitiesSettings from "./pages/school/UtilitiesSettings";
import EmailSender from "./pages/school/EmailSender";
import SchoolsList from "./pages/admin/SchoolsList";
import SchoolForm from "./pages/admin/SchoolForm";
import SendEmail from "./pages/admin/SendEmail";
import UsersList from "./pages/admin/UsersList";
import RepresentativeDashboard from "./pages/representative/RepresentativeDashboard";
import RepresentativesList from "./pages/representative/RepresentativesList";
import RepStudentsList from "./pages/representative/StudentsList";
import EditFamilyData from "./pages/representative/EditFamilyData";
import RepAddRepresentative from "./pages/representative/RepAddRepresentative";
import RepAddStudent from "./pages/representative/RepAddStudent";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              path="/school/configuraciones/inscripcion-campos" 
              element={
                <ProtectedRoute requiredRole="school">
                  <EnrollmentDisplayConfig />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/school/configuraciones/utilidades" 
              element={
                <ProtectedRoute requiredRole="school">
                  <UtilitiesSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/utilidades/correo" 
              element={
                <ProtectedRoute requiredRole="school">
                  <EmailSender />
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
              path="/inscripciones" 
              element={
                <ProtectedRoute requiredRole="school">
                  <EnrollmentsList />
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
              path="/registros/areas" 
              element={
                <ProtectedRoute requiredRole="school">
                  <SubjectsList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registros/asignacion-areas" 
              element={
                <ProtectedRoute requiredRole="school">
                  <SubjectAssignments />
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
            <Route 
              path="/admin/enviar-email" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <SendEmail />
                </ProtectedRoute>
              } 
            />
            {/* Representative routes */}
            <Route path="/representative/dashboard" element={<ProtectedRoute requiredRole="representative"><RepresentativeDashboard /></ProtectedRoute>} />
            <Route path="/representative/representantes" element={<ProtectedRoute requiredRole="representative"><RepresentativesList /></ProtectedRoute>} />
            <Route path="/representative/estudiantes" element={<ProtectedRoute requiredRole="representative"><RepStudentsList /></ProtectedRoute>} />
            <Route path="/representative/datos-familia" element={<ProtectedRoute requiredRole="representative"><EditFamilyData /></ProtectedRoute>} />
            <Route path="/representative/representante/nuevo" element={<ProtectedRoute requiredRole="representative"><RepAddRepresentative /></ProtectedRoute>} />
            <Route path="/representative/representante/:representativeId/editar" element={<ProtectedRoute requiredRole="representative"><RepAddRepresentative /></ProtectedRoute>} />
            <Route path="/representative/estudiante/nuevo" element={<ProtectedRoute requiredRole="representative"><RepAddStudent /></ProtectedRoute>} />
            <Route path="/representative/estudiante/:studentId/editar" element={<ProtectedRoute requiredRole="representative"><RepAddStudent /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
