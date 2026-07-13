# `desc/` — Descripción funcional por tema (Spec-Driven Development)

Esta carpeta contiene **un archivo por tema/responsabilidad** del sistema SAT Escolar.
El objetivo es tener, para cada dominio (pagos, asistencias, notas, etc.), un archivo
que describa **qué operaciones existen, qué funciones cumplen y qué hace cada rol** sobre
ese tema. Este contexto sirve como base para búsquedas futuras, onboarding y para redactar
specs de nuevas features (Spec-Driven Development).

## Cómo se organiza

- El eje principal es el **tema** (dominio funcional), no el rol.
- Dentro de cada archivo se detalla la participación de cada rol.
- Los archivos se van **completando uno a uno**; las secciones aún sin verificar están
  marcadas como `> ⏳ Por documentar`.

## Roles del sistema

| Rol (código) | Nombre | Descripción |
|---|---|---|
| `admin` | Administrador SAT | Super-administrador de la plataforma. Gestiona colegios y datos globales. |
| `school` | Colegio | Personal del colegio. Tiene **permisos granulares** (ver abajo). |
| `teacher` | Docente | Profesor asignado a áreas/aulas. |
| `representative` | Representante | Padre/madre/tutor. Ve su familia, estudiantes y pagos. |

### Permisos del rol `school`

El rol `school` puede ser **owner** (acceso total) o **sub-usuario** con perfiles de
permisos asignados. Cada ítem del menú se muestra según el permiso (`usePermissions`).
Ver [`02-usuarios-y-permisos.md`](02-usuarios-y-permisos.md).

## Plantilla de cada archivo

```
# <Tema>

## Resumen
## Roles involucrados
## Casos de uso               (narrativa: actor → objetivo → resultado)
## Operaciones / Funciones     (tabla: operación · rol · ruta · permiso · descripción)
## Rutas (frontend)
## Endpoints / Edge Functions  (funciones de `supabase/functions/` que usa el tema)
## Datos / Tablas (Supabase)
## Reglas de negocio
## Archivos clave (código)
## Por documentar
```

## Conceptos transversales (leer antes de tocar lo académico/financiero)

- **La "asignación" (`subject_teacher_assignments`) es el eje académico:** representa
  *docente × área × sección × año escolar*. Plan de evaluación, notas, aula virtual y
  asistencias cuelgan de su `assignment_id`. Ver [06-areas-materias](06-areas-materias.md).
- **Año activo:** `school_years.is_active` marca el año en curso; muchos flujos operan
  sobre él (balances de pago, asignaciones). Ver [15-configuracion-colegio](15-configuracion-colegio.md).
- **Datos dinámicos de personas:** representantes/estudiantes/docentes guardan sus campos
  en un `form_data` (JSON) definido por los **Formularios** (`form_fields`). Ver
  [15-configuracion-colegio](15-configuracion-colegio.md).
- **Formatos de impresión:** boleta (`boleta_templates`) y factura (`invoice_templates`)
  se configuran en `/formatos` y deben respetarse al generar/imprimir. Ver
  [09-notas](09-notas-y-boletas.md) y [12-pagos](12-pagos.md).
- **Dinero en VES:** el estado de cuenta se calcula sobre `student_concept_balances`
  (no sobre `payments`); conversión con `bcv_rates`. Ver [12-pagos](12-pagos.md).

## Backend (Edge Functions)

La lógica de servidor vive en `supabase/functions/` (Deno). Cada archivo de tema lista en
**Endpoints / Edge Functions** las funciones que le corresponden. Utilidades compartidas en
`supabase/functions/_shared/`. El esquema de datos se define en `supabase/migrations/`.

## Índice de temas

> ⭐ **Antes de programar cualquier tema, lee las [Convenciones de desarrollo](CONVENTIONS.md)**
> (inglés en el código, SOLID, pruebas, formato, una responsabilidad por archivo y más).
> Es de cumplimiento obligatorio y aplica a todos los temas de abajo.

| # | Archivo | Tema |
|---|---|---|
| ⭐ | [CONVENTIONS.md](CONVENTIONS.md) | Convenciones de desarrollo (transversal, obligatorio) |
| 00 | [00-autenticacion-y-roles.md](00-autenticacion-y-roles.md) | Autenticación, roles y control de acceso |
| 01 | [01-colegios.md](01-colegios.md) | Colegios (alta y gestión global) |
| 02 | [02-usuarios-y-permisos.md](02-usuarios-y-permisos.md) | Usuarios, administradores y permisos |
| 03 | [03-familias-y-representantes.md](03-familias-y-representantes.md) | Familias y representantes |
| 04 | [04-estudiantes.md](04-estudiantes.md) | Estudiantes |
| 05 | [05-docentes.md](05-docentes.md) | Docentes |
| 06 | [06-areas-materias.md](06-areas-materias.md) | Áreas / materias y su asignación |
| 07 | [07-inscripciones.md](07-inscripciones.md) | Inscripciones |
| 08 | [08-planillas.md](08-planillas.md) | Planillas |
| 09 | [09-notas-y-boletas.md](09-notas-y-boletas.md) | Notas y boletas |
| 10 | [10-asistencias.md](10-asistencias.md) | Asistencias (QR, registro, dashboard) |
| 11 | [11-aula-virtual.md](11-aula-virtual.md) | Aula virtual y supervisión |
| 12 | [12-pagos.md](12-pagos.md) | Pagos y administrativo |
| 13 | [13-correos.md](13-correos.md) | Correos y plantillas |
| 14 | [14-carnet.md](14-carnet.md) | Carnet |
| 15 | [15-configuracion-colegio.md](15-configuracion-colegio.md) | Configuración del colegio |
| 16 | [16-busqueda-avanzada.md](16-busqueda-avanzada.md) | Búsqueda avanzada |
| 17 | [17-importacion-de-datos.md](17-importacion-de-datos.md) | Importación de datos |
| 18 | [18-dashboards.md](18-dashboards.md) | Dashboards por rol |
