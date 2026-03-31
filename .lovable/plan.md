

# Plan: Módulo de Asistencias por QR

## Resumen

Construir un sistema completo de asistencias por QR que permita registrar el ingreso de estudiantes, representantes y docentes al escanear su carnet, guardar el registro en base de datos, enviar notificaciones por correo y gestionar los registros desde un panel administrativo.

## Situación actual

- Los carnets ya generan QR con datos como `DOCENTE|NombreCompleto|Documento|Colegio` (texto plano).
- No existe infraestructura de asistencias ni tokens seguros en el QR.
- El sistema de correos SMTP ya funciona vía la Edge Function `send-email`.

---

## Arquitectura propuesta

```text
┌─────────────┐    Escaneo QR     ┌──────────────────┐
│  Lector QR  │ ──────────────── │ /attendance/scan/ │ (ruta pública)
│  (físico)   │   URL con token   │    :token         │
└─────────────┘                   └────────┬─────────┘
                                           │
                                   invoke Edge Function
                                           │
                                  ┌────────▼──────────┐
                                  │ record-attendance  │
                                  │  (Edge Function)   │
                                  ├────────────────────┤
                                  │ 1. Validar token   │
                                  │ 2. Identificar rol │
                                  │ 3. Anti-duplicado  │
                                  │ 4. INSERT registro │
                                  │ 5. Enviar correo   │
                                  │ 6. Retornar JSON   │
                                  └────────────────────┘
```

---

## Cambios en la base de datos

### 1. Nueva tabla: `attendance_tokens`
Almacena tokens seguros para cada persona del sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid PK | |
| token | text UNIQUE | Token aleatorio seguro (UUID v4) |
| entity_type | text | `student`, `teacher`, `representative` |
| entity_id | uuid | ID en la tabla correspondiente |
| school_id | uuid FK | Colegio al que pertenece |
| is_active | boolean | Para desactivar tokens |
| created_at | timestamptz | |

Indice unico en `(entity_type, entity_id)` para un token por persona.

### 2. Nueva tabla: `attendance_records`
Tabla unificada para todos los registros de asistencia.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid PK | |
| school_id | uuid FK | |
| entity_type | text | `student`, `teacher`, `representative` |
| entity_id | uuid | ID de la persona |
| token_id | uuid FK | Referencia al token usado |
| attendance_date | date | Fecha del registro |
| attendance_time | time | Hora del registro |
| attendance_timestamp | timestamptz | Timestamp completo |
| record_type | text | `qr` (extensible) |
| status | text | `present`, `late`, etc. |
| notification_sent | boolean | Si se envió correo |
| notification_email | text | Email al que se notificó |
| created_at | timestamptz | |

Indice en `(entity_type, entity_id, attendance_date)` para consultas rápidas y anti-duplicados.

### 3. RLS Policies
- Solo lectura para usuarios `school` del mismo colegio.
- Sin acceso directo para otros roles (todo pasa por Edge Function con service role).

### 4. Trigger para generar tokens automáticamente
Al insertar un nuevo student, teacher o representative, generar automáticamente un token en `attendance_tokens`. Tambien hacer un backfill de tokens para los registros existentes.

---

## Cambios en el QR de los carnets

### Actualizar contenido del QR
Actualmente el QR contiene texto plano. Se cambiará para que contenga una URL:

```
https://app.satescolar.com/attendance/scan/{token}
```

Archivos a modificar:
- `src/lib/export-utils.ts` - Función de generación de carnet PDF (estudiantes y representantes)
- `src/pages/teacher/TeacherCarnet.tsx` - Carnet de docente

La función de generación consultará `attendance_tokens` para obtener el token de cada persona antes de generar el QR.

---

## Edge Function: `record-attendance`

Endpoint que recibe el token y procesa todo el flujo:

1. Recibir `token` del body
2. Buscar en `attendance_tokens` el token, verificar `is_active`
3. Obtener `entity_type` y `entity_id`
4. Verificar anti-duplicado: no registrar si ya existe un registro en los últimos 60 segundos para la misma persona
5. Insertar en `attendance_records`
6. Determinar email de notificación:
   - **Teacher**: su propio `email`
   - **Student/Representative**: email del `auth.users` de la familia (`families.user_id`)
7. Enviar correo via SMTP (reutilizando la lógica de `send-email`)
8. Retornar JSON con datos para mostrar en pantalla

---

## Nuevas páginas frontend

### 1. Escáner QR (`/utilidades/escaner-qr`)
Pantalla simple para recepción/entrada:
- Input autofocused que recibe la lectura del escáner físico (actúa como teclado)
- Al detectar una URL o token completo (por Enter), invoca la Edge Function
- Muestra tarjeta de resultado:
  - Nombre completo
  - Rol (badge con color)
  - Fecha y hora
  - Estado (exito, error, ya registrado, QR inválido)
- Feedback visual con colores: verde (exito), rojo (error), amarillo (duplicado)
- Se limpia automáticamente después de 5 segundos para el siguiente escaneo

### 2. Asistencias (`/utilidades/asistencias`)
Panel administrativo con:
- 3 Tabs: Docentes, Estudiantes, Representantes
- Cada tab con:
  - Buscador inteligente (nombre, apellido, combinaciones, insensible a acentos)
  - Filtros de fecha: Hoy, Últimos 7 días, Último mes, Últimos 6 meses, Últimos 12 meses, Rango personalizado
  - Tabla con columnas: Nombre, Apellido, Fecha, Hora, Tipo, Estado, Correo notificado, Creado
  - Paginación (50 registros por página)

### 3. Ruta pública: `/attendance/scan/:token`
Página pública (sin autenticación) que:
- Extrae el token de la URL
- Invoca la Edge Function
- Muestra resultado al usuario que escaneó (confirmación simple)

---

## Cambios en el sidebar

Agregar en la sección "Utilidades" del rol `school`:
- "Escáner QR" con icono `QrCode`
- "Asistencias" con icono `ClipboardList`

---

## Correos de notificación

Se usará la Edge Function `send-email` existente (SMTP) para enviar correos con formato HTML que incluyan:
- Logo del colegio
- Nombre del usuario
- Rol
- Fecha y hora de ingreso
- Mensaje de confirmación
- Branding de SAT ESCOLAR

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `supabase/functions/record-attendance/index.ts` | Edge Function principal |
| `src/pages/school/AttendanceScanner.tsx` | Pantalla de escáner QR |
| `src/pages/school/AttendanceList.tsx` | Panel administrativo de asistencias |
| `src/pages/AttendanceScan.tsx` | Ruta pública para escaneo directo |
| Migración SQL | Tablas, indices, RLS, trigger de tokens |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar 3 nuevas rutas |
| `src/components/layout/AppSidebar.tsx` | Agregar items en Utilidades |
| `src/lib/export-utils.ts` | QR con URL de asistencia en lugar de texto plano |
| `src/pages/teacher/TeacherCarnet.tsx` | QR con URL de asistencia |
| `supabase/config.toml` | Agregar `record-attendance` con `verify_jwt = false` |

---

## Orden de implementación

1. Migración SQL (tablas, tokens, trigger, backfill, RLS)
2. Edge Function `record-attendance`
3. Página pública `/attendance/scan/:token`
4. Página escáner QR `/utilidades/escaner-qr`
5. Página administrativa `/utilidades/asistencias`
6. Sidebar + rutas en App.tsx
7. Actualizar QR en carnets (export-utils + TeacherCarnet)

