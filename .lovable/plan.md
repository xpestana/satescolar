

## Plan: Email de bienvenida para familias y docentes

### Resumen
Agregar envío automático de email de bienvenida al crear una familia (`create-family`) y al crear un docente (`create-teacher`). Ambos usan SMTP (denominailer) directo desde la edge function, "fire and forget".

### Cambios

**1. Modificar `supabase/functions/create-family/index.ts`**

Después de crear exitosamente la familia (solo para usuarios nuevos, no existentes):
- Consultar la tabla `schools` para obtener `name` y `logo_url` usando `roleData.school_id`
- Construir HTML del email con:
  - Header: logo del colegio (si existe) + nombre del colegio
  - Body: mensaje de bienvenida como representante, credenciales (email + contraseña generada), botón "Ingresar a la Plataforma" → `https://satescolar.lovable.app`
  - Footer: "SAT ESCOLAR — satescolar.com"
- Enviar vía SMTP usando los secrets ya configurados (SMTP_HOST, SMTP_USER, etc.)
- Fire and forget: si falla el email, se loguea pero no bloquea la respuesta

**2. Modificar `supabase/functions/create-teacher/index.ts`**

Mismo patrón, después de crear exitosamente el docente (solo usuarios nuevos):
- Consultar `schools` para `name` y `logo_url`
- HTML similar pero con mensaje orientado a docentes: "Ha sido registrado como docente en [Colegio]..."
- Mismas credenciales (email + contraseña = número de documento)
- Mismo botón CTA y footer SAT ESCOLAR

### Template HTML (compartido, parametrizado)

```text
┌─────────────────────────────┐
│      [Logo del Colegio]     │
│     Nombre del Colegio      │
├─────────────────────────────┤
│                             │
│  ¡Bienvenido/a!             │
│                             │
│  Ha sido registrado como    │
│  [representante/docente]    │
│  en [Nombre Colegio]        │
│  a través de SAT Escolar.   │
│                             │
│  Sus credenciales:          │
│  Usuario: email@...         │
│  Contraseña: xxxxxx         │
│                             │
│  [Ingresar a la Plataforma] │
│                             │
├─────────────────────────────┤
│  SAT ESCOLAR                │
│  satescolar.com             │
└─────────────────────────────┘
```

### Archivos a modificar
- `supabase/functions/create-family/index.ts` — agregar import denomailer, fetch school data, construir HTML, enviar email
- `supabase/functions/create-teacher/index.ts` — mismo patrón con mensaje de docente

No se requieren cambios en frontend ni base de datos.

