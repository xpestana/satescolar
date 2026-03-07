

## Plan: Separar Asignación GCRP de Regular

### Problema
Actualmente las materias GCRP se asignan igual que las regulares (docente + sección completa). Los GCRP deben asignarse a un docente + estudiantes individuales, no a secciones completas.

### Paso 1: Limpiar datos GCRP existentes

Usar la herramienta de inserción/eliminación de datos para:
1. Eliminar `student_grades` vinculados a assignments de materias GCRP
2. Eliminar `evaluation_plan_items` vinculados a assignments de materias GCRP  
3. Eliminar `subject_teacher_assignments` donde la materia es de tipo GCRP

### Paso 2: Crear tabla `gcrp_assignment_students`

Nueva migración para crear la tabla que vincula estudiantes individuales a asignaciones GCRP:

```sql
CREATE TABLE public.gcrp_assignment_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES subject_teacher_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE gcrp_assignment_students ENABLE ROW LEVEL SECURITY;
```

Con RLS policies para school users y teachers (similar a `subject_teacher_assignments`).

Para las asignaciones GCRP, `section_id` en `subject_teacher_assignments` se dejará NULL (requiere alterar la columna para hacerla nullable).

```sql
ALTER TABLE subject_teacher_assignments ALTER COLUMN section_id DROP NOT NULL;
```

### Paso 3: Modificar la UI de `SubjectAssignments.tsx`

Separar el flujo del diálogo "Nueva Asignación" según el tipo de materia seleccionada:

**Regular (sin cambios):** Docente → Nivel/Grado → Sección → Asignar

**GCRP (nuevo flujo):**
1. Seleccionar Área GCRP
2. Seleccionar Docente
3. Selector cascada: Nivel/Grado → Sección (para buscar estudiantes)
4. Mostrar tabla de estudiantes inscritos en esa sección/año escolar
5. Checkboxes individuales + botón "Seleccionar toda la sección"
6. Permitir repetir pasos 3-5 para agregar estudiantes de distintas secciones
7. Mostrar lista acumulada de estudiantes seleccionados antes de confirmar
8. Al confirmar: crear `subject_teacher_assignment` (sin section_id) + insertar registros en `gcrp_assignment_students`

### Paso 4: Actualizar la tabla de visualización

En la tabla de asignaciones, las GCRP mostrarán:
- En lugar de "Sección / Grado": mostrar cantidad de estudiantes (ej: "12 estudiantes")
- Posibilidad de ver/editar los estudiantes asignados mediante un modal

### Paso 5: Actualizar TeacherGrades para GCRP

Actualmente `TeacherGrades.tsx` busca estudiantes por `enrollments` filtrando por `section_id`. Para asignaciones GCRP, deberá buscar estudiantes desde `gcrp_assignment_students` en lugar de `enrollments`.

### Paso 6: Actualizar GradesConsultation para GCRP

Similar al paso 5, la consulta de notas debe considerar que los GCRP traen estudiantes de `gcrp_assignment_students`.

### Archivos a modificar
- **Migración SQL**: Crear tabla `gcrp_assignment_students`, hacer `section_id` nullable
- **`src/pages/school/SubjectAssignments.tsx`**: Separar flujos regular/GCRP, nuevo diálogo GCRP
- **`src/pages/teacher/TeacherGrades.tsx`**: Condicional para obtener estudiantes según tipo
- **`src/pages/school/GradesConsultation.tsx`**: Mismo ajuste
- **`src/pages/teacher/TeacherSubjects.tsx`**: Posible ajuste en visualización

