## Plan

1. **Corregir resolución de nombres para docentes**
   - Ajustar la función de backend que resuelve nombres de usuarios para que el docente propietario de la asignación pueda resolver autores del aula aunque no exista un registro en `user_roles` para ese docente.
   - Mantener la restricción por colegio/curso para no exponer nombres fuera del aula correspondiente.

2. **Corregir nombres de estudiantes en comentarios/reacciones**
   - Mejorar `resolve_student_display_names` para devolver nombre completo del estudiante con fallbacks (`primer_nombre`, `segundo_nombre`, `primer_apellido`, `segundo_apellido`, `nombre`, `apellido`, `document_id`).
   - En el componente de comentarios, mostrar fallback claro como `Estudiante` solo mientras carga o si faltan datos.

3. **Asegurar reacciones visibles en docente**
   - Revisar la carga de `classroom_reactions` en `CommentsAndReactions` para Muro y Trabajo.
   - Agregar manejo de error visible en consola/toast si la consulta falla por permisos, en vez de quedar silenciosamente sin reacciones.
   - Mantener el tooltip/listado de quién reaccionó usando el nombre del estudiante cuando la reacción fue hecha desde el acceso del estudiante.

4. **Aplicar en Muro y Trabajo**
   - Usar la misma corrección para publicaciones del Muro (`postId`) y actividades de Trabajo (`activityId`), porque ambos ya comparten `CommentsAndReactions`.

5. **Validación**
   - Verificar que el código compila a nivel de tipos relevantes y que no se modifica el cliente autogenerado.
   - Dejar los comandos de VPS para aplicar la migración y reconstruir el frontend.