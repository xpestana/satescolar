

## Agregar Sección y Grado a la Asignación de Áreas

Actualmente cada asignación solo vincula Area + Docente + Ano Escolar. Falta indicar en que seccion (y su grado/ano) se imparte. Este cambio agrega ese campo tanto en la base de datos como en ambas interfaces (colegio y docente).

---

### 1. Migración de base de datos

Agregar columna `section_id` a la tabla `subject_teacher_assignments`:

- Nueva columna `section_id UUID NOT NULL` con referencia a `sections(id)` y `ON DELETE CASCADE`
- Eliminar la restriccion unica actual `(subject_id, teacher_id, school_year_id)` y reemplazarla por `(subject_id, teacher_id, school_year_id, section_id)` -- ya que un mismo docente puede dar la misma materia en diferentes secciones
- Agregar politica RLS para que los docentes puedan ver las secciones de su colegio

### 2. Actualizar pagina de Asignacion de Areas (colegio)

**Archivo:** `src/pages/school/SubjectAssignments.tsx`

- Agregar fetch de secciones del colegio (`sections` table)
- Agregar un tercer Select en el dialogo de "Nueva Asignacion" para elegir la seccion (mostrando grado + nombre, ej: "1er Ano - A")
- Incluir `section_id` en el insert de la mutacion
- Actualizar la tabla de asignaciones para mostrar una columna "Seccion / Grado" con el nombre de la seccion y su grado
- Actualizar la interface `Assignment` para incluir `section_id`
- Actualizar la restriccion unique en la validacion de error 23505

### 3. Actualizar vista del docente (Mis Materias)

**Archivo:** `src/pages/teacher/TeacherSubjects.tsx`

- Incluir la relacion `section:section_id(id, name, grade_level)` en el query de asignaciones
- Mostrar en cada tarjeta de materia la seccion y grado correspondiente (ej: "1er Ano - Seccion A")
- Actualizar la interface `AssignmentWithDetails` para incluir los datos de seccion

---

### Detalles tecnicos

**Migracion SQL:**
```sql
ALTER TABLE public.subject_teacher_assignments
  ADD COLUMN section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE;

-- Reemplazar constraint unica
ALTER TABLE public.subject_teacher_assignments
  DROP CONSTRAINT IF EXISTS subject_teacher_year_unique;

ALTER TABLE public.subject_teacher_assignments
  ADD CONSTRAINT subject_teacher_year_section_unique
  UNIQUE (subject_id, teacher_id, school_year_id, section_id);

-- RLS: docentes pueden ver secciones de su colegio
CREATE POLICY "Teachers can view school sections"
  ON public.sections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid() AND t.school_id = sections.school_id
  ));
```

**Archivos a modificar:**
- Nueva migracion SQL
- `src/pages/school/SubjectAssignments.tsx` -- agregar selector de seccion y columna en tabla
- `src/pages/teacher/TeacherSubjects.tsx` -- mostrar seccion/grado en cada tarjeta

