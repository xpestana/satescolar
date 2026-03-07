

## Separar Asignación GCRP de Regular — COMPLETADO

### Cambios realizados:

1. **Datos GCRP limpiados**: Se eliminaron todos los `student_grades`, `evaluation_plan_items` y `subject_teacher_assignments` vinculados a materias GCRP.

2. **Migración SQL ejecutada**:
   - `section_id` en `subject_teacher_assignments` ahora es nullable (para GCRP)
   - Nueva tabla `gcrp_assignment_students` con RLS para school users, teachers y admins

3. **SubjectAssignments.tsx**: Flujo separado Regular vs GCRP
   - Regular: Docente → Nivel/Grado → Sección (sin cambios)
   - GCRP: Docente → Buscar estudiantes por nivel/sección → Seleccionar individuales o todos → Crear asignación sin section_id + registros en `gcrp_assignment_students`
   - Tabla muestra "X estudiantes" para GCRP con modal de visualización

4. **TeacherGrades.tsx**: Obtiene estudiantes desde `gcrp_assignment_students` cuando la asignación es GCRP

5. **GradesConsultation.tsx**: Misma lógica condicional para GCRP vs Regular

6. **TeacherSubjects.tsx**: Muestra "GCRP — Estudiantes individuales" cuando section es null
