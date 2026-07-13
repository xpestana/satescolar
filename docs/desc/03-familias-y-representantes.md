# Familias y representantes

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Gestión de las familias del colegio y de la información de los representantes (padres/tutores).
El colegio administra el padrón de familias; el representante ve y edita su propia familia.

## Roles involucrados
- **school** — administra familias (permiso `families.view`).
- **representative** — ve/gestiona su familia, representantes y datos.

## Casos de uso
- El colegio da de alta una familia con su(s) representante(s).
- Se actualiza el email o la contraseña de acceso de una familia.
- El representante consulta y edita los datos de su familia.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Listar familias | school | `/registros/familias` | `families.view` | Padrón de familias del colegio. |
| Mis representantes | representative | `/representative/representantes` | — | Representantes de la familia. |
| Datos de la familia | representative | `/representative/datos-familia` | — | Información de la familia. |

## Rutas (frontend)
- `/registros/familias`
- `/representative/representantes`
- `/representative/datos-familia`

## Endpoints / Edge Functions
- `create-family` — alta de familia + representante + credenciales.
- `update-family-email` — cambio de email de acceso.
- `update-family-password` — cambio de contraseña de acceso.

## Datos / Tablas (Supabase)
- `families` — datos socioeconómicos y de contacto de la familia: apellidos padre/madre,
  vivienda (`housing_*`, `rooms_count`, `property_ownership`), ingresos (`monthly_income`,
  `income_contributor`), transporte, `dependents_count`, geo (`state_id`,
  `municipality_id`, `parish_id`, `city_id`), `is_suspended`, `user_id`.
- `representatives` — `family_id`, `document_id`, `email`, `phone`, `is_primary`,
  `photo_url`, **`form_data` (JSON)** (campos del Formulario de representantes).
- `students` — cuelgan de `family_id` (ver [04-estudiantes](04-estudiantes.md)).
- `family_schools` / `student_schools` — vínculo familia/estudiante ↔ colegio.

## Reglas de negocio (datos)
- Una familia agrupa representantes y estudiantes; `is_primary` marca al representante
  principal. Las credenciales de acceso se ligan por `user_id`.

## Reglas de negocio
> ⏳ Por documentar.

## Archivos clave (código)
- `src/pages/school/FamiliesList.tsx`
- `src/pages/representative/RepresentativesList.tsx`
- `src/components/families/...`

## Configuración relacionada
- El **formulario de representantes** se edita en Formularios
  (`/school/configuraciones/formularios/representantes`) — ver [15-configuracion-colegio](15-configuracion-colegio.md).

## Por documentar
- Relación familia ↔ representantes ↔ estudiantes.
