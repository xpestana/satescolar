import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider } from "@/hooks/useSidebarState";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import GradesSettings from "./pages/school/GradesSettings";
import GradesConsultation from "./pages/school/GradesConsultation";
import GradeSheets from "./pages/school/GradeSheets";
import EmailSender from "./pages/school/EmailSender";
import SchoolsList from "./pages/admin/SchoolsList";
import SchoolForm from "./pages/admin/SchoolForm";
import SendEmail from "./pages/admin/SendEmail";
import UsersList from "./pages/admin/UsersList";
import AdminUsersList from "./pages/admin/AdminUsersList";
import S3TestUpload from "./pages/admin/S3TestUpload";
import ImportData from "./pages/admin/ImportData";
import ImportGrades from "./pages/admin/ImportGrades";
import RepresentativeDashboard from "./pages/representative/RepresentativeDashboard";
import RepresentativesList from "./pages/representative/RepresentativesList";
import RepStudentsList from "./pages/representative/StudentsList";
import EditFamilyData from "./pages/representative/EditFamilyData";
import RepAddRepresentative from "./pages/representative/RepAddRepresentative";
import RepAddStudent from "./pages/representative/RepAddStudent";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherSubjects from "./pages/teacher/TeacherSubjects";
import TeacherCarnet from "./pages/teacher/TeacherCarnet";
import TeacherGrades from "./pages/teacher/TeacherGrades";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import ClassroomList from "./pages/teacher/ClassroomList";
import ClassroomDetail from "./pages/teacher/ClassroomDetail";
import ChildClassroom from "./pages/representative/ChildClassroom";
import RepPayments from "./pages/representative/RepPayments";
import RepStudentGrades from "./pages/representative/StudentGrades";

import ClassroomSupervision from "./pages/school/ClassroomSupervision";
import AttendanceScan from "./pages/AttendanceScan";
import AttendanceScanner from "./pages/school/AttendanceScanner";
import AttendanceList from "./pages/school/AttendanceList";
import AttendanceDashboard from "./pages/school/AttendanceDashboard";
import PaymentDashboard from "./pages/school/PaymentDashboard";
import PaymentConfig from "./pages/school/PaymentConfig";
import PaymentRegistration from "./pages/school/PaymentRegistration";
import PayrollDashboard from "./pages/school/PayrollDashboard";
import PayrollRegistration from "./pages/school/PayrollRegistration";
import PayrollBeneficiaries from "./pages/school/PayrollBeneficiaries";
import PayrollConfig from "./pages/school/PayrollConfig";
import StudentLedger from "./pages/school/StudentLedger";
import DelinquentStudents from "./pages/school/DelinquentStudents";
import DelinquencyConfig from "./pages/school/DelinquencyConfig";
import IncomesReport from "./pages/school/IncomesReport";
import FormatsConfig from "./pages/school/FormatsConfig";
import NotFound from "./pages/NotFound";
import SchoolUsersList from "./pages/school/SchoolUsersList";
import SchoolUserForm from "./pages/school/SchoolUserForm";
import PermissionProfileForm from "./pages/school/PermissionProfileForm";
import EmailTemplatesList from "./pages/school/EmailTemplatesList";
import EmailTemplateEditor from "./pages/school/EmailTemplateEditor";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallAppPrompt />
      <BrowserRouter>
        <AuthProvider>
          <SidebarProvider>
            <ErrorBoundary>
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
              <Route path="/school/configuraciones/correos" element={<ProtectedRoute requiredRole="school"><EmailTemplatesList /></ProtectedRoute>} />
              <Route path="/school/configuraciones/correos/:type" element={<ProtectedRoute requiredRole="school"><EmailTemplateEditor /></ProtectedRoute>} />
              <Route path="/school/configuraciones/usuarios" element={<ProtectedRoute requiredRole="school"><SchoolUsersList /></ProtectedRoute>} />
              <Route path="/school/configuraciones/usuarios/nuevo" element={<ProtectedRoute requiredRole="school"><SchoolUserForm /></ProtectedRoute>} />
              <Route path="/school/configuraciones/usuarios/:userId/editar" element={<ProtectedRoute requiredRole="school"><SchoolUserForm /></ProtectedRoute>} />
              <Route path="/school/configuraciones/usuarios/perfiles/nuevo" element={<ProtectedRoute requiredRole="school"><PermissionProfileForm /></ProtectedRoute>} />
              <Route path="/school/configuraciones/usuarios/perfiles/:profileId/editar" element={<ProtectedRoute requiredRole="school"><PermissionProfileForm /></ProtectedRoute>} />
              <Route
                path="/school/configuraciones/ajustes-notas"
                element={
                  <ProtectedRoute requiredRole="school">
                    <GradesSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notas/consulta"
                element={
                  <ProtectedRoute requiredRole="school">
                    <GradesConsultation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planillas"
                element={
                  <ProtectedRoute requiredRole="school">
                    <GradeSheets />
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
                path="/admin/administradores"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminUsersList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/prueba-s3"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <S3TestUpload />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/importar-datos"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ImportData />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/importar-calificaciones"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ImportGrades />
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
              <Route path="/representative/estudiante/:studentId/notas" element={<ProtectedRoute requiredRole="representative"><RepStudentGrades /></ProtectedRoute>} />
              <Route path="/representative/aula-virtual/:studentId" element={<ProtectedRoute requiredRole="representative"><ChildClassroom /></ProtectedRoute>} />
              <Route path="/representative/pagos" element={<ProtectedRoute requiredRole="representative"><RepPayments /></ProtectedRoute>} />
              {/* Teacher routes */}
              <Route path="/teacher/dashboard" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/teacher/materias" element={<ProtectedRoute requiredRole="teacher"><TeacherSubjects /></ProtectedRoute>} />
              <Route path="/teacher/materias/:assignmentId/notas" element={<ProtectedRoute requiredRole="teacher"><TeacherGrades /></ProtectedRoute>} />
              <Route path="/teacher/aula-virtual" element={<ProtectedRoute requiredRole="teacher"><ClassroomList /></ProtectedRoute>} />
              <Route path="/teacher/aula-virtual/:assignmentId" element={<ProtectedRoute requiredRole="teacher"><ClassroomDetail /></ProtectedRoute>} />
              <Route path="/teacher/carnet" element={<ProtectedRoute requiredRole="teacher"><TeacherCarnet /></ProtectedRoute>} />
              <Route path="/teacher/asistencias" element={<ProtectedRoute requiredRole="teacher"><TeacherAttendance /></ProtectedRoute>} />
              {/* Attendance routes */}
              <Route path="/attendance/scan/:token" element={<AttendanceScan />} />
              <Route path="/attendance/scan/:token/*" element={<AttendanceScan />} />
              <Route path="/utilidades/escaner-qr" element={<ProtectedRoute requiredRole="school"><AttendanceScanner /></ProtectedRoute>} />
              <Route path="/utilidades/asistencias" element={<ProtectedRoute requiredRole="school"><AttendanceList /></ProtectedRoute>} />
              <Route path="/utilidades/asistencias-dashboard" element={<ProtectedRoute requiredRole="school"><AttendanceDashboard /></ProtectedRoute>} />
              {/* Payment routes */}
              <Route path="/pagos" element={<ProtectedRoute requiredRole="school"><PaymentDashboard /></ProtectedRoute>} />
              <Route path="/pagos/configuracion" element={<ProtectedRoute requiredRole="school"><PaymentConfig /></ProtectedRoute>} />
              <Route path="/pagos/registro" element={<ProtectedRoute requiredRole="school"><PaymentRegistration /></ProtectedRoute>} />
              <Route path="/pagos/estado-cuenta" element={<ProtectedRoute requiredRole="school"><StudentLedger /></ProtectedRoute>} />
              <Route path="/pagos/morosos" element={<ProtectedRoute requiredRole="school"><DelinquentStudents /></ProtectedRoute>} />
              <Route path="/pagos/morosidad" element={<ProtectedRoute requiredRole="school"><DelinquencyConfig /></ProtectedRoute>} />
              <Route path="/pagos/ingresos" element={<ProtectedRoute requiredRole="school"><IncomesReport /></ProtectedRoute>} />
              {/* Payroll (Pagos de Nóminas) routes */}
              <Route path="/pagos/nomina" element={<ProtectedRoute requiredRole="school"><PayrollDashboard /></ProtectedRoute>} />
              <Route path="/pagos/nomina/registro" element={<ProtectedRoute requiredRole="school"><PayrollRegistration /></ProtectedRoute>} />
              <Route path="/pagos/nomina/beneficiarios" element={<ProtectedRoute requiredRole="school"><PayrollBeneficiaries /></ProtectedRoute>} />
              <Route path="/pagos/nomina/configuracion" element={<ProtectedRoute requiredRole="school"><PayrollConfig /></ProtectedRoute>} />
              <Route path="/formatos" element={<ProtectedRoute requiredRole="school"><FormatsConfig /></ProtectedRoute>} />

              <Route path="/pagos/reportes" element={<Navigate to="/pagos/registro?tab=reportes" replace />} />
              <Route path="/school/aula-virtual/supervision" element={<ProtectedRoute requiredRole="school"><ClassroomSupervision /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </SidebarProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
