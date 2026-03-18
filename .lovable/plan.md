

## Plan: Sábana de Notas — Gestión de Planillas para Secundaria

### Objetivo
Crear una nueva sección "Planillas" en el sidebar del colegio con una página dedicada a generar y descargar "Sábanas de Notas" para secundaria (1er Año a 6to Año). Cada sábana muestra las notas definitivas por área de todos los estudiantes de una sección, ordenados por cédula.

### Estructura de datos disponible
- `final_grades`: contiene `grade_value`, `adjustment_points`, `momento` (1,2,3), vinculado a `assignment_id` y `student_id`
- `subject_teacher_assignments`: vincula materia-docente-sección-año escolar
- `school_subjects`: las áreas/materias
- `enrollments` + `sections`: estudiantes inscritos por sección
- `students`: `document_id`, `form_data` (con primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)

No se requieren cambios de base de datos. Todos los datos necesarios ya existen.

### Cambios

#### 1. Nueva página `src/pages/school/GradeSheets.tsx`
Interfaz con:
- **Filtros**: Año escolar (combobox, auto-selecciona activo) y Momento (1, 2, 3, Definitiva Anual)
- **Lista de secciones**: Solo secciones de secundaria (`1_ano` a `6_ano`) que tengan al menos un estudiante inscrito en el año escolar seleccionado
- Cada sección muestra un botón "Descargar PDF" individual
- Botón global "Descargar Todas" que genera un PDF con todas las secciones en un mismo documento

#### 2. Generación del PDF (usando jsPDF + autoTable existentes)
Cada sábana de notas (una página por sección/momento):
- **Encabezado**: Nombre del colegio, "Notas del momento X" o "Notas Definitivas", año escolar, sección
- **Tabla**: Columnas: N°, Cédula, Apellidos y Nombres, [una columna por cada área asignada a esa sección], Prom, Pos, Aplaz, N°
- **Filas**: Estudiantes ordenados por cédula (`document_id`)
- **Datos por celda**: Nota definitiva del momento (o promedio de los 3 momentos para la "Definitiva Anual")
- **Promedio**: Media de todas las áreas con 1 decimal
- **Posición**: Ranking por promedio dentro de la sección
- **Aplaz**: Cantidad de áreas con nota < 10 (aplazadas)
- **Adjustment points**: Se muestran en la celda como nota ya ajustada; la columna de ajuste se refleja con indicador visual o columna extra si `adjustment_points != 0`
- **Fila Promedios**: Al final, promedio de cada columna

#### 3. Momento "Definitiva Anual"
- Para cada estudiante y cada área: promedio de las notas de los 3 momentos (redondeado a 1 decimal)
- Misma lógica de posición, aplazados, etc.

#### 4. Sidebar y Routing
- Agregar sección "Planillas" en el sidebar del school con enlace a `/planillas/sabana-notas`
- Agregar ruta en `App.tsx`

#### 5. Lógica de consulta
- Obtener secciones secundarias con enrollments del año seleccionado
- Para cada sección: obtener assignments (materia-docente-sección), luego `final_grades` del momento seleccionado
- Agrupar por estudiante, calcular promedios y posiciones

### Archivos a crear/modificar
- **Crear**: `src/pages/school/GradeSheets.tsx`
- **Modificar**: `src/components/layout/AppSidebar.tsx` (agregar sección Planillas)
- **Modificar**: `src/App.tsx` (agregar ruta)
- **Modificar**: `src/lib/export-utils.ts` (agregar función `exportSabanaDeNotas`)

