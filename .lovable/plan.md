

# Panel de Envio de Correos para Colegios

## Resumen
Crear un panel de envio de correos dentro del "Area de Utilidades" del sidebar, con una interfaz tipo Gmail moderna. El colegio podra enviar correos individuales o masivos a docentes, familias, o correos personalizados. Los correos se enviaran con un template HTML profesional similar a la imagen de referencia (estilo e-commerce/formal), usando los colores configurados del carnet y el logo del colegio.

## Cambios a realizar

### 1. Agregar link en el sidebar
Agregar "Correo" como item dentro de "AREA DE UTILIDADES" en `AppSidebar.tsx`, con icono Mail y ruta `/utilidades/correo`.

### 2. Nueva pagina: `src/pages/school/EmailSender.tsx`
Pagina principal con DashboardLayout que contiene el componente EmailComposer. Se conecta con la ruta protegida para rol "school".

### 3. Nuevo componente: `src/components/utilities/EmailComposer.tsx`
Panel con diseno tipo Gmail, layout de 2 columnas en desktop:

**Columna izquierda - Formulario de composicion:**
- **Seccion de destinatarios**: 
  - Botones rapidos: "Todos los docentes", "Todas las familias"
  - Dropdowns para seleccionar docentes individuales (nombre + email) y familias individuales (representante principal + email)
  - Input manual para agregar correos libres
  - Los destinatarios seleccionados se muestran como chips/badges removibles con X
- **Campo Asunto**: Input de texto
- **Campo Mensaje**: Textarea grande para el cuerpo del correo
- **Boton Enviar**: Con confirmacion y estado de carga

**Columna derecha - Vista previa en tiempo real:**
- Renderizado del template HTML del email tal como lo recibira el destinatario
- Se actualiza en tiempo real mientras el usuario escribe

### 4. Template HTML del email
Estructura similar a la imagen de referencia:
- Header con color primario del colegio + logo centrado + nombre del colegio
- Titulo/asunto en texto grande
- Cuerpo del mensaje
- Linea separadora con color secundario
- Footer: "Desarrollado por SATEscolar" con link a satescolar.com, fondo con color primario

### 5. Modificar edge function: `supabase/functions/send-email/index.ts`
- Ampliar validacion de roles para aceptar tanto `admin` como `school`
- Para rol `school`, verificar que el usuario tiene un `school_id` asociado (seguridad basica)
- El body ya llega como HTML desde el frontend

### 6. Agregar ruta en `src/App.tsx`
Nueva ruta `/utilidades/correo` protegida con rol "school" que renderiza EmailSender.

## Flujo de datos para destinatarios
- **Docentes**: Query a tabla `teachers` filtrada por `school_id`, extrayendo `email` y nombre desde `form_data`
- **Familias**: Query a `representatives` con `is_primary = true`, unido via `families` -> `family_schools` filtrado por `school_id`, obteniendo `email` y nombre desde `form_data`
- **Manual**: Input libre de correos

## Detalles tecnicos

### Archivos a crear:
- `src/pages/school/EmailSender.tsx` - Pagina wrapper
- `src/components/utilities/EmailComposer.tsx` - Componente principal con toda la logica

### Archivos a modificar:
- `src/components/layout/AppSidebar.tsx` - Agregar item "Correo" en Area de Utilidades
- `src/App.tsx` - Agregar ruta `/utilidades/correo`
- `supabase/functions/send-email/index.ts` - Permitir rol "school" ademas de "admin"

### Dependencias: No se necesitan nuevas dependencias. Se reutilizan componentes existentes (Badge, Button, Input, Textarea, Card, Popover, Command) y la edge function send-email existente con SMTP.

### Seguridad: La edge function valida que el usuario autenticado tenga rol `admin` o `school` en la tabla `user_roles`. No se exponen datos de otros colegios gracias al filtro por `school_id` en las queries de docentes y familias (protegidas por RLS).

