
# Plan: Agregar opcion de descargar planilla en inscripciones

## Resumen

Se agrega una opcion "Descargar Planilla" en el menu desplegable de acciones de cada estudiante en la lista de inscripciones. Al hacer clic, se genera y descarga el PDF de la planilla de inscripcion con todos los datos del estudiante, representante, familia y configuracion del colegio.

---

## Cambios en `src/pages/school/EnrollmentsList.tsx`

### 1. Importaciones nuevas
- Importar `downloadPlanillaInscripcion` desde `@/lib/export-utils`
- Importar `FileDown` desde `lucide-react` (icono para el menu)
- Importar `toast` desde `sonner` (para notificaciones de progreso)

### 2. Funcion `handleDownloadPlanilla`
Se crea una funcion asincrona que recibe un `StudentWithEnrollment` y:
- Muestra un toast "Generando planilla..."
- Hace fetch en paralelo de:
  - Datos completos de la familia (`families`)
  - Representante principal (`representatives` con `is_primary = true`)
  - Secciones de la planilla (`enrollment_planilla_sections`)
  - Configuracion general (`planilla_general_config`)
  - Enrollment con su seccion (`enrollments` con join a `sections`)
  - Datos geograficos del colegio (state, municipality, city, parish)
  - Form fields (student + representative) para labels
- Resuelve geo de la familia tambien
- Llama a `downloadPlanillaInscripcion` con todos los datos
- Maneja errores con toast de error

La logica sigue el mismo patron ya implementado en `src/pages/representative/StudentsList.tsx`.

### 3. Datos del colegio
Se necesita acceso a los datos del colegio (school). Se agrega un query para obtener los datos del colegio usando `schoolId`, ya que actualmente solo se tiene el ID pero no los datos completos (nombre, logo, codigos, etc.).

### 4. Agregar opcion al DropdownMenu
En el `DropdownMenuContent` de cada fila, se agrega un nuevo `DropdownMenuItem`:

```text
<DropdownMenuItem onClick={() => handleDownloadPlanilla(student)}>
  <FileDown className="h-4 w-4 mr-2" />
  Descargar Planilla
</DropdownMenuItem>
```

Se coloca despues de las 3 opciones de edicion existentes.

---

## Secuencia tecnica

1. Agregar query para datos del colegio (`schools` por `schoolId`)
2. Agregar query para year activo (ya existe como `activeYear`)
3. Crear funcion `handleDownloadPlanilla`
4. Agregar item al dropdown menu

No se requieren migraciones de base de datos ni cambios en otros archivos.
