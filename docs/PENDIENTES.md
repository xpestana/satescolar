# Pendientes

Trabajo identificado y aún no hecho. Cada entrada lleva el contexto necesario para retomarla sin
tener que redescubrirlo. Al terminar una, bórrala de aquí (o muévela a la sección de hechos) y
documenta el resultado en el `docs/desc/` que corresponda.

> 🧭 Al implementar, sigue las [Convenciones de desarrollo](desc/CONVENTIONS.md).

---

## 1. Los permisos de los sub-usuarios del colegio solo ocultan el menú (seguridad)

**Prioridad:** alta · **Detectado:** 2026-11-27, revisando el inicio de sesión (commit `1a3479b`).
**Temas:** [00-autenticacion-y-roles](desc/00-autenticacion-y-roles.md),
[02-usuarios-y-permisos](desc/02-usuarios-y-permisos.md).

### Qué pasa
Un colegio tiene un **dueño** (`user_roles.is_owner = true`, acceso total) y puede crear
**sub-usuarios** (`role = 'school'`, `is_owner = false`) a los que asigna perfiles de permisos
(`school_user_profiles` → `permission_profiles` → `permission_profile_items.permission_key`, con
`scope` opcional por grado o año escolar).

Esos permisos **solo se aplican en la interfaz**: `usePermissions().has(...)` esconde ítems del menú
(`AppSidebar.tsx`) y algunas pantallas redirigen. Pero:

- **Base de datos (RLS):** las políticas "School users …" exigen `is_school_staff(school_id)`, que
  es verdadero para **cualquier** usuario `school` del colegio, dueño o sub-usuario, tenga o no el
  permiso. Son ~186 usos en `20261006130000_restrict_school_policies_to_staff.sql`.
- **Rutas:** `ProtectedRoute` valida el rol, no el permiso. La doc ya lo advierte para
  `/notas/consulta` (`grades.view` no protege la ruta: basta escribir la URL).
- **Edge Functions:** `create-teacher`, `create-family` y `resend-welcome-email` solo comprueban que
  quien llama sea `school` del colegio (`getCallerRole(..., ["school"])`). No miran sus permisos.
  `manage-school-subuser` **sí** lo hace bien (dueño o `settings.users`) y sirve de modelo.

### Riesgo
Un sub-usuario al que el dueño le quitó, por ejemplo, Pagos o Docentes puede igualmente leer y
modificar esos datos llamando directo a la API de Supabase (con su propio token) o a las Edge
Functions: crear docentes o familias, ver pagos, notas, nómina… Siempre **dentro de su colegio**:
no cruza a otros colegios. Lo que falla es la separación de funciones dentro del colegio.

### Cómo abordarlo (propuesta)
1. **Catálogo:** cerrar la lista de `permission_key` y a qué tablas y acciones da derecho cada una
   (también está pendiente en `02-usuarios-y-permisos.md`).
2. **Helper SQL** `STABLE SECURITY DEFINER`, por ejemplo `has_school_permission(school_id, key)`:
   verdadero si es el dueño, o si es sub-usuario con ese `permission_key` en alguno de sus perfiles.
   El `scope` por grado o año puede ir en una segunda fase.
3. **RLS por módulo:** sustituir `is_school_staff(school_id)` por
   `has_school_permission(school_id, '<clave>')` en las políticas de las tablas sensibles
   (pagos, nómina, notas, docentes, familias, usuarios…). Mantener `is_school_staff` en las lecturas
   que todo el personal necesita (colegio, años, secciones…).
4. **Edge Functions:** en `create-teacher`, `create-family` y `resend-welcome-email` exigir el
   permiso como ya hace `manage-school-subuser`. Factorizarlo en `_shared` para no repetirlo.
5. **Rutas:** añadir un `requiredPermission` opcional a `ProtectedRoute`, para que la URL directa
   también respete el permiso (hoy solo se esconde el menú).
6. **Pruebas:** con un sub-usuario sin permiso, comprobar por API directa que recibe 403 o 0 filas.
   El dueño y un sub-usuario con el permiso deben seguir viendo exactamente lo mismo que hoy.

### Datos útiles
- Hoy hay 6 dueños y 11 sub-usuarios en producción. Para pruebas: el sub-usuario
  `709064e4-9a70-4de7-b01f-0403f02acedd` del colegio demo tiene 10 permisos.
- Los permisos del usuario llegan ya en `get_my_context()` (`permissions`), así que el front no
  necesita consultas nuevas.
- Aplicar migraciones desde Windows: `scripts/migrate.sh` no funciona (descarga la CLI de Linux);
  usar la API de administración y registrar la versión en `supabase_migrations.schema_migrations`.
  Revisar acentos después (ver la nota sobre U+FFFD en producción).

---

## Otros cabos sueltos (menores)

- **Datos de prueba en el colegio demo** (creados para los videos tutoriales del 2026-11-26/27):
  - 4 áreas «(Demo)»: Química, Grupo de Creación y Producción, Orientación y Convivencia,
    Innovación Tecnológica.
  - La docente **Andrea Demo Prueba** (V-30111222, andrea.demo@example.com) y su asignación
    Química (Demo) → 4to Año U.
  - Dos notas descriptivas de Julieta Sara Dávila (1er Grado U, Momento 1).
  - La asistencia del 27/11 en Matemáticas 3er Año U, Momento 1.

  Decidir si se borran.
- **Carnet del colegio demo:** no tiene diseño configurado (Ajustes del Colegio → Carnet), así que
  el docente solo ve un aviso. Configurarlo si se quiere grabar un tutorial del carnet.
- **`src/integrations/supabase/types.ts`:** se añadieron a mano `attendance_records.school_year_id`,
  `get_teacher_attendance_summary` y `get_my_context`. Regenerar los tipos con la CLI para que
  queden exactamente como los produce Supabase.
- **Usuarios con más de una fila en `user_roles`:** un comentario de `create-teacher` y
  `create-family` dice que el personal "puede ser también representante". Si eso ocurre, el inicio de
  sesión no le asigna rol, igual que antes de `get_my_context` (hoy no hay ninguno en producción).
  Definir qué debería pasar en ese caso.
