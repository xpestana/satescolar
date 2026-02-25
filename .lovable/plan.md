
# Panel de Envio de Correos en Utilidades

## Resumen
Agregar un nuevo panel tipo "Gmail" dentro de la pagina de Utilidades para que los colegios puedan enviar correos individuales o masivos a docentes, familias, o correos personalizados. Los correos se enviaran con un template HTML profesional que usa los colores del carnet configurados, el logo del colegio, y un footer con "Desarrollado por SATEscolar".

## Componentes a crear/modificar

### 1. Nuevo componente: `src/components/utilities/EmailComposer.tsx`
Panel principal con diseno tipo Gmail que incluye:

- **Barra de destinatarios inteligente**:
  - Input para escribir correos manuales (chips/tags)
  - Botones rapidos: "Todos los docentes", "Todos las familias"
  - Dropdown para seleccionar docentes individuales (con nombre y email)
  - Dropdown para seleccionar familias individuales (representante principal con email)
  - Los chips muestran nombre + email y se pueden eliminar con X

- **Campo de Asunto**: Input estandar

- **Campo de Mensaje**: Textarea grande para el cuerpo del correo

- **Barra lateral de vista previa**: Muestra como se vera el email HTML final en tiempo real con:
  - Header con color primario del colegio y logo
  - Asunto como titulo
  - Cuerpo del mensaje
  - Footer con "Desarrollado por SATEscolar - satescolar.com"

- **Boton Enviar**: Con estado de loading y confirmacion

### 2. Modificar: `src/pages/school/UtilitiesSettings.tsx`
- Agregar un nuevo AccordionItem "Envio de Correos" con icono Mail debajo del de Carnet
- Importar y renderizar el componente EmailComposer
- Pasar los colores del carnet (primaryColor, secondaryColor) y el logo del colegio al componente

### 3. Modificar: `supabase/functions/send-email/index.ts`
- Ampliar la verificacion de roles para aceptar tanto `admin` como `school`
- Cuando el rol es `school`, validar que el usuario solo envie a docentes/familias de su propio colegio (seguridad)
- El body del email ya se enviara como HTML desde el frontend

## Flujo de datos para destinatarios

- **Docentes**: Query a `teachers` filtrado por `school_id`, usando campos `email` y `form_data` (para nombre)
- **Familias**: Query a `representatives` unido con `families` por `family_id`, filtrado por familias del colegio. Se obtiene email del representante principal (`is_primary = true`) o del primer representante
- **Manual**: El usuario escribe el correo directamente

## Template HTML del email

El template se construira en el frontend antes de enviarlo. Estructura:

```text
+------------------------------------------+
|  [Color Primario - Header]               |
|  [Logo del Colegio]                      |
|  Nombre del Colegio                      |
+------------------------------------------+
|                                          |
|  [Asunto como titulo H1]                 |
|                                          |
|  [Cuerpo del mensaje]                    |
|                                          |
|  [Imagen placeholder]                    |
|                                          |
+------------------------------------------+
|  [Color Primario - Footer]               |
|  Desarrollado por SATEscolar             |
|  satescolar.com                          |
+------------------------------------------+
```

Los colores del header/footer usaran `primaryColor` y `secondaryColor` de la configuracion del carnet.

## Detalles tecnicos

- Se reutiliza la edge function `send-email` existente, solo se modifica la validacion de rol
- Los destinatarios se envian como array al backend
- El HTML del email se genera en el cliente usando una funcion helper `buildEmailHtml()`
- Se obtiene la lista de docentes y familias con queries a las tablas `teachers` y `representatives` + `families`, filtradas por `school_id`
- Para familias, se necesita obtener el `school_id` indirectamente via `students.family_id` ya que las familias no tienen `school_id` directo. Alternativa: usar `families.user_id` con `user_roles.school_id`
- El componente EmailComposer usara Badges para los destinatarios seleccionados, estilo chips removibles
- Vista previa en tiempo real del email al lado del formulario (layout 2 columnas en desktop)
