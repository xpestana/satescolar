# Búsqueda avanzada

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Buscador transversal del colegio para localizar familias, estudiantes, docentes, etc.,
con filtros avanzados.

## Roles involucrados
- **school** — acceso al buscador (sin permiso específico; visible para el rol `school`).

## Casos de uso
> ⏳ Por documentar.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Búsqueda avanzada | school | `/registros/busqueda-avanzada` | — | Búsqueda con filtros. |

## Rutas (frontend)
- `/registros/busqueda-avanzada`

## Endpoints / Edge Functions
> ⏳ Por documentar (consultas directas vs. función de búsqueda).

## Datos / Tablas (Supabase)
> ⏳ Por documentar (entidades y campos indexados/consultados).

## Acciones por fila
La columna **Acciones** (fija a la izquierda de la tabla) ofrece: **Ver** (abre `ViewFamilyModal`,
o `ViewTeacherModal` en la pestaña Docentes), **Editar**, **Descargar Carnet** y, según la
pestaña activa:

- **Estudiantes** — interruptor de **bloqueo de notas y boletas** para el representante
  (`StudentGradeAccessToggle` sobre `student_grade_access`). El mismo bloqueo se opera desde la
  ficha de la familia y desde `/notas/consulta` → pestaña "Visibilidad para Representantes";
  ver [09-notas](09-notas-y-boletas.md).
- **Representantes** — marcar como representante principal (`is_primary`).

## Reglas de negocio
> ⏳ Por documentar.

## Archivos clave (código)
- `src/pages/school/AdvancedSearch.tsx`
- `src/components/search/...`
- `src/components/students/StudentGradeAccessToggle.tsx` (acción de bloqueo de notas)

## Por documentar
- Qué entidades y campos abarca la búsqueda; este archivo es un consumidor clave de la
  descripción de los demás temas (`desc/`).
