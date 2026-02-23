

# Plan: Mejoras en la Lista de Inscripciones

## Resumen

Se implementaran 4 mejoras principales en el modulo de inscripciones:
1. Selector de columnas visibles en la tabla
2. Indicador de campos de inscripcion en el constructor de planillas
3. Fondo rojo/verde segun completitud de datos del estudiante
4. Validacion en el modal de inscripcion

---

## 1. Selector de columnas visibles en la tabla de inscripciones

**Que se hace:** Se agrega un boton junto a la barra de busqueda que abre un popover/dropdown con checkboxes para mostrar/ocultar columnas de la tabla.

**Columnas disponibles:**
- Foto, Nombre, Cedula, Familia, Grado, Estado (las actuales fijas)
- Columnas adicionales basadas en los campos configurados en las secciones de la planilla de inscripcion (`enrollment_planilla_sections`), excluyendo los campos de tipo `custom:` que son de inscripcion (seccion, tipo, fecha)

**Por defecto:** Todas las columnas de la planilla visibles. Se usa `enrollment_planilla_sections` para obtener los `field_names` activos y mapearlos a columnas de la tabla.

**Archivo:** `src/pages/school/EnrollmentsList.tsx`
- Se agrega query para `enrollment_planilla_sections`
- Estado local `visibleColumns` con Set de nombres de columnas
- Boton con icono `Columns` de lucide + Popover con checkboxes
- La tabla renderiza dinamicamente las columnas seleccionadas

---

## 2. Indicador de campos de inscripcion en el constructor de planillas

**Que se hace:** En la seccion "Informacion para la Inscripcion" del constructor de planillas, los campos `custom:` que corresponden a datos de inscripcion (`tipo_de_estudiante`, `grupo_asignado`, `fecha_de_inscripcion`) se marcan con una estrella o icono especial para diferenciarlos.

**Archivo:** `src/pages/school/EnrollmentDisplayConfig.tsx`
- En la lista de campos custom de cada seccion, si el campo es uno de los 3 campos de inscripcion conocidos (`custom:tipo_de_estudiante`, `custom:grupo_asignado`, `custom:fecha_de_inscripcion`), se muestra un icono de estrella y un tooltip indicando que "Este campo se llena automaticamente al inscribir".
- Se agrega una lista predefinida de campos custom de inscripcion como select rapido (para que no necesiten escribirlos manualmente).

**Migracion:** Actualizar el trigger `create_default_form_fields` para incluir los campos de inscripcion correctamente marcados en la seccion por defecto.

---

## 3. Fondo rojo/verde segun completitud de datos

**Que se hace:** Cada fila de la tabla de inscripciones se colorea segun si el estudiante tiene todos sus datos completos o no.

**Logica de validacion:**
- Se obtienen los `field_names` de todas las `enrollment_planilla_sections` del colegio
- Se excluyen los campos que pertenecen al area de inscripcion: `custom:tipo_de_estudiante`, `custom:grupo_asignado`, `custom:fecha_de_inscripcion`
- Para cada estudiante, se verifica si los campos de tipo `student:*` estan llenos en su `form_data`
- Los campos `representative:*` y `family:*` requieren datos adicionales (se cargan representante principal y familia)

**Colores:**
- Fondo verde claro (`bg-green-50`) si todos los campos no-inscripcion estan completos
- Fondo rojo claro (`bg-red-50`) si falta algun campo

**Archivo:** `src/pages/school/EnrollmentsList.tsx`
- Se agregan queries para cargar representantes principales y datos de familia
- Funcion `checkStudentCompleteness()` que evalua cada campo contra los datos disponibles
- Se aplica clase CSS condicional en el `TableRow`

---

## 4. Validacion en el modal de inscripcion

**Que se hace:** En el modal `EnrollStudentModal`, si faltan campos por rellenar (no de inscripcion), en lugar de mostrar el boton "Inscribir", se muestran botones para ir a editar los datos faltantes.

**Logica:**
- Se reutiliza la misma logica de completitud del punto 3
- Se cargan las secciones de la planilla y se verifican los campos del estudiante, representante y familia
- Si hay campos faltantes:
  - Se muestra un aviso visual (alerta amarilla/naranja) listando los campos incompletos
  - El footer muestra botones: "Modificar Estudiante", "Modificar Representante", "Modificar Familia" segun donde esten los campos faltantes
  - El boton "Inscribir" se oculta o se deshabilita
- Si todos los campos estan completos, se muestra el boton "Inscribir" normalmente

**Archivo:** `src/components/enrollments/EnrollStudentModal.tsx`
- Se agrega query para `enrollment_planilla_sections`
- Se agrega query para representante principal y datos de familia completos
- Funcion de validacion de completitud
- Renderizado condicional del footer

---

## Secuencia tecnica de archivos a modificar

1. `src/pages/school/EnrollmentsList.tsx` - Columnas dinamicas + fondo rojo/verde + queries adicionales
2. `src/components/enrollments/EnrollStudentModal.tsx` - Validacion de completitud + botones condicionales
3. `src/pages/school/EnrollmentDisplayConfig.tsx` - Indicador de campos de inscripcion con estrella + select rapido

No se requieren migraciones de base de datos ya que los campos de inscripcion conocidos se identifican por convencion (`custom:tipo_de_estudiante`, `custom:grupo_asignado`, `custom:fecha_de_inscripcion`).

