

# Datos para Inscripciones - Dos Secciones de Configuracion

## Resumen
Reestructurar la pagina de configuracion de inscripciones para incluir dos secciones: una para los campos del modal de inscripcion (existente) y otra nueva para configurar la planilla de inscripcion con grupos personalizables de campos.

## Cambios Visuales
- Renombrar "Campos de Inscripcion" a "Datos para Inscripciones" en sidebar y breadcrumbs
- Usar Tabs para separar las dos secciones:
  - Tab 1: "Modal de Inscripcion" (funcionalidad existente)
  - Tab 2: "Planilla de Inscripcion" (nueva)
- En la seccion de planilla: interfaz para crear multiples grupos, cada uno con un titulo editable y una seleccion de campos de estudiante mediante switches/checkboxes, con boton para agregar mas grupos y eliminar grupos existentes

## Cambios en Base de Datos
Crear una nueva tabla `enrollment_planilla_sections` con:
- `id` (uuid, PK)
- `school_id` (uuid, NOT NULL)
- `title` (text, NOT NULL) - titulo del grupo/seccion
- `display_order` (integer, default 0)
- `field_names` (jsonb, default '[]') - array de field_names seleccionados
- `created_at`, `updated_at`

RLS policies identicas a las de `enrollment_display_config` (school users pueden CRUD en su school, admins todo).

## Cambios en Codigo

### 1. Migracion SQL
- Crear tabla `enrollment_planilla_sections`
- Habilitar RLS con politicas para school y admin

### 2. `src/integrations/supabase/types.ts`
- Se actualizara automaticamente tras la migracion

### 3. `src/pages/school/EnrollmentDisplayConfig.tsx`
- Agregar Tabs con dos pestanas
- Tab 1: mantener la logica existente de switches para el modal
- Tab 2: nueva interfaz de planilla con:
  - Boton "Agregar Seccion" que crea un nuevo grupo
  - Cada grupo tiene: campo de texto para el titulo, lista de campos de estudiante con switches
  - Boton para eliminar grupo
  - Boton guardar que persiste todos los grupos
- Queries para leer/escribir `enrollment_planilla_sections`

### 4. `src/components/layout/AppSidebar.tsx`
- Cambiar label de "Campos de Inscripcion" a "Datos para Inscripciones"

## Flujo del Usuario (Planilla)
1. El usuario entra a Ajustes > Datos para Inscripciones
2. Selecciona la pestana "Planilla de Inscripcion"
3. Hace clic en "Agregar Seccion"
4. Escribe un titulo (ej: "Datos Basicos del Estudiante")
5. Activa los campos que desea incluir en esa seccion
6. Puede agregar mas secciones con otros titulos y campos
7. Guarda toda la configuracion

