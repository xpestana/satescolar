## Diagnóstico encontrado

- Hay una migración local (`20260514120000_auto_owner_on_school_user_insert.sql`) que fuerza `is_owner = true` para cualquier `user_roles.role = 'school'`. Eso explica por qué los subusuarios creados desde el colegio terminan como dueños.
- El endpoint `manage-school-subuser` intenta crear subusuarios con `is_owner: false`, pero esa regla de base de datos lo contradice.
- La pantalla `/school/configuraciones/usuarios` lista usuarios desde `user_roles` por `school_id`, pero si todos quedan como dueños, la UI los trata como administradores de acceso completo y bloquea edición/reset/eliminación.
- La creación desde `/admin/usuarios` sí debe crear usuario escolar dueño del colegio; la creación desde `/school/configuraciones/usuarios/nuevo` debe crear subusuario no dueño y asignarle solo los perfiles seleccionados.

## Plan de corrección

1. **Base de datos: separar dueño vs subusuario**
   - Eliminar el trigger que convierte automáticamente todos los usuarios `school` en dueños.
   - Reemplazarlo por una regla segura que solo impida dejar un colegio sin dueño, sin modificar a los subusuarios.
   - Corregir datos existentes: marcar como `is_owner = false` los usuarios escolares que tengan perfiles asignados en `school_user_profiles`, preservando como dueños a los usuarios creados desde administración.

2. **Backend de creación de usuarios**
   - Mantener `/admin/usuarios` usando `create-admin-user` para crear usuarios escolares con `is_owner = true` y `school_id` obligatorio.
   - Ajustar `manage-school-subuser` para que al crear desde el colegio inserte explícitamente `is_owner = false` y valide que los perfiles seleccionados pertenezcan al mismo colegio antes de asignarlos.
   - Si falla la asignación de perfiles, revertir el usuario creado para evitar usuarios incompletos.

3. **Listado de usuarios del colegio**
   - Ajustar `/school/configuraciones/usuarios` para mostrar todos los `user_roles.role = 'school'` del colegio: dueños y subusuarios.
   - Mostrar dueños como “Administrador (acceso completo)” y subusuarios con sus perfiles seleccionados.
   - Mantener bloqueadas las acciones peligrosas para dueños y permitir edición/reset/eliminación solo para subusuarios.

4. **Validación final**
   - Revisar que la creación desde administración deje `is_owner = true`.
   - Revisar que la creación desde el colegio deje `is_owner = false` y guarde perfiles.
   - Revisar que el listado del colegio muestre todos los usuarios escolares asociados al `school_id` correcto.