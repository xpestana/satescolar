# Estudiantes

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Gestión de los estudiantes: alta, datos y relación con la familia. El representante ve
sus estudiantes; el colegio los gestiona a través de familias, inscripciones y notas.

## Roles involucrados
- **representative** — ve sus estudiantes, edita datos y descarga carnet/planilla.
- **school** — gestiona estudiantes (vía familias / inscripciones).

## Casos de uso
- El representante consulta la lista de estudiantes de su familia.
- Desde **Mis Estudiantes**, el representante puede descargar el **carnet** y la
  **planilla de inscripción** (menú Descargas en cada tarjeta de estudiante).
- El colegio gestiona estudiantes e inscripciones desde familias e inscripciones.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Mis estudiantes | representative | `/representative/estudiantes` | — | Estudiantes de la familia. |
| Descargar carnet | representative | `/representative/estudiantes` | — | Carnet PDF desde menú Descargas. |
| Descargar planilla de inscripción | representative | `/representative/estudiantes` | — | Planilla PDF (misma lógica que school). |

## Rutas (frontend)
- `/representative/estudiantes`

## Endpoints / Edge Functions
> ⏳ Por documentar (probablemente gestionados vía `create-family` / importación).

## Datos / Tablas (Supabase)
- `students` — `family_id`, `document_id`, `photo_url`, `status` (enum `student_status`),
  **`form_data` (JSON)** con los campos dinámicos definidos por el Formulario de
  estudiantes (ver [15](15-configuracion-colegio.md)).
  - **Claves canónicas del nombre** dentro de `form_data`: `primer_nombre`, `segundo_nombre`,
    `primer_apellido`, `segundo_apellido`. El nombre a mostrar se arma
    `[primer_nombre, primer_apellido].filter(Boolean).join(" ")` (patrón usado en toda la app;
    ver búsqueda en `PaymentRegistration.tsx` y la tabla de "Últimos Pagos" en [12-pagos](12-pagos.md)).
- Vínculos: `enrollments` (año/sección, ver [07](07-inscripciones.md)),
  `student_schools`/`student_concept_balances`/`student_payment_plans`
  (ver [12-pagos](12-pagos.md)).

## Reglas de negocio
- La descarga de planilla desde representante usa la configuración del colegio
  (`enrollment_planilla_sections`, `planilla_general_config`) y no bloquea por campos
  opcionales vacíos (ver [07-inscripciones](07-inscripciones.md)).

## Archivos clave (código)
- `src/pages/representative/StudentsList.tsx`

## Configuración relacionada
- El **formulario de estudiantes** se edita en Formularios
  (`/school/configuraciones/formularios/estudiantes`) — ver [15-configuracion-colegio](15-configuracion-colegio.md).
- La **planilla de inscripción** se configura en
  `/school/configuraciones/inscripcion-campos` — ver [08-planillas](08-planillas.md).

## Por documentar
- Ciclo de vida del estudiante (inscripción → año escolar → sección → notas).
