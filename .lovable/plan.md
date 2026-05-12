## Objetivo

1. Reemplazar la palabra **Materias / Materia** por **Áreas / Área** en toda la interfaz visible para el usuario.
2. Asegurar que las métricas del Dashboard de colegio (Estudiantes Inscritos, Docentes, Materias, etc.) se actualicen correctamente en el VPS y no muestren ceros cuando sí hay datos.

---

## Parte 1 — Renombrado "Materias" → "Áreas"

Cambios solo de texto visible (no se tocan nombres de tablas, columnas, rutas internas como `/teacher/materias`, ni claves de DB).

Archivos y líneas a editar:

- `src/pages/teacher/TeacherSubjects.tsx` → "Mis Materias" → "Mis Áreas"
- `src/pages/teacher/TeacherGrades.tsx` (líneas 220, 258) → "Mis Materias" → "Mis Áreas"
- `src/pages/teacher/TeacherDashboard.tsx` (línea 43) → "Mis Materias Asignadas" → "Mis Áreas Asignadas"
- `src/pages/school/SubjectsList.tsx` (línea 179) → "Áreas / Materias" → "Áreas"
- `src/pages/school/SubjectAssignments.tsx` (líneas 503, 600) → "Área / Materia" → "Área"
- `src/pages/school/SchoolDashboard.tsx` (línea 193) → tarjeta "Materias" → "Áreas"
- `src/pages/school/GradesConsultation.tsx` (línea 287) → "Área / Materia" → "Área"
- `src/pages/school/ClassroomSupervision.tsx` (línea 199) → encabezado "Materia" → "Área"
- `src/pages/representative/ChildClassroom.tsx` (línea 236) → fallback "Materia" → "Área"
- `src/components/layout/AppSidebar.tsx` (línea 168) → ítem docente "Materias" → "Áreas"
- `src/components/layout/PageHeader.tsx` (líneas 25, 26, 37, 61, 63, 64) → títulos y descripciones equivalentes
- `src/components/classroom/ClassroomTutorial.tsx` (líneas 121, 126) → textos de tutorial

No se tocan: nombres de tablas (`school_subjects`, `subject_teacher_assignments`), rutas `/teacher/materias`, ni `subject?.name` que viene de la BD.

---

## Parte 2 — Métricas del Dashboard que no se actualizan en VPS

### Diagnóstico

Verifiqué la base de datos del entorno cloud (Lovable) y el colegio principal contiene:
`enrollments=3, student_schools=6, teachers=2, school_subjects=5, subject_teacher_assignments=9, family_schools=2`.

Las queries en `SchoolDashboard.tsx` están bien escritas: filtran por `school_id` y, cuando aplica, por el `school_year_id` activo.

Causas probables de que el VPS muestre ceros:

1. **Caché de React Query**: las queries no definen `staleTime` ni `refetchOnMount`, por lo que tras navegar por la app pueden quedar congeladas con el primer resultado (incluso 0 si se cargaron antes de existir un año escolar activo).
2. **PostgREST sin recarga de schema** tras la última migración del VPS: las tablas existen pero el endpoint REST aún no las expone, devolviendo `count=0`.
3. **Sin `school_year` activo en el VPS**: las métricas `Estudiantes Inscritos` y `Áreas Asignadas` dependen de `is_active=true` en `school_years`. Si ningún año está marcado activo, devuelven 0 aunque haya datos.

### Cambios de código (frontend)

En `src/pages/school/SchoolDashboard.tsx`:

- Añadir a cada `useQuery` de métrica:
  ```ts
  staleTime: 30_000,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
  ```
- Para las métricas dependientes del año escolar activo (`enrolledStudents`, `assignedSubjects`), si `activeSchoolYear` es `null` mostrar el badge "Sin año escolar activo" en lugar de `0`, para que el usuario entienda por qué el dato es cero.

### Acciones en el VPS (a ejecutar después de hacer `git pull`)

```bash
cd ~/satescolar
git pull
docker compose run --rm sat-migrations
docker exec sat-db psql -U supabase_admin -d postgres -c "NOTIFY pgrst, 'reload schema';"
docker compose up -d --build sat-app
```

Y verificar en Studio (`http://<vps>:3000`) que la tabla `school_years` tenga al menos un registro con `is_active=true` para el colegio afectado. Si no, activarlo desde "Períodos y Secciones" en la app.

---

## Resumen de archivos modificados

- `src/pages/school/SchoolDashboard.tsx` (texto + opciones de query)
- `src/pages/teacher/TeacherSubjects.tsx`
- `src/pages/teacher/TeacherGrades.tsx`
- `src/pages/teacher/TeacherDashboard.tsx`
- `src/pages/school/SubjectsList.tsx`
- `src/pages/school/SubjectAssignments.tsx`
- `src/pages/school/GradesConsultation.tsx`
- `src/pages/school/ClassroomSupervision.tsx`
- `src/pages/representative/ChildClassroom.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/classroom/ClassroomTutorial.tsx`
