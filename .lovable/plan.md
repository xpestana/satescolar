## Plan

Agregar acciones de editar/eliminar a los comentarios del aula virtual.

### Comportamiento

- **Editar**: solo el autor del comentario puede editarlo (sea docente, representante o estudiante a través del código).
  - En modo edición: el texto se reemplaza por un input con botones "Guardar" / "Cancelar".
  - Se actualiza `content` y `updated_at`.
- **Eliminar**:
  - El autor puede eliminar su propio comentario.
  - El docente dueño de la asignación puede eliminar cualquier comentario del muro o actividad de su clase (incluidos los del estudiante / representante).
  - Confirmación con `AlertDialog` antes de borrar.
- Los iconos de editar (lápiz) y eliminar (papelera) aparecen en un menú `⋯` junto a cada comentario, solo si el usuario tiene permiso.

### Detección de permisos en el cliente

- Autor: `comment.author_id === user.id`.
- Docente dueño: nuevo hook/consulta ligera que verifique si el usuario actual es el `teacher` dueño de la asignación del post/actividad. Se hace una sola vez por componente (cacheado con react-query) usando `subject_teacher_assignments` + `teachers` filtrando por `user_id = auth.uid()`.

### Backend

- Las políticas RLS existentes ya permiten:
  - "Users can manage their own comments" (autor edita/borra).
  - "Teachers can manage comments on their content" (docente borra cualquier comentario de su clase).
  - "School users can manage comments" y "Admins can manage all comments".
- No requiere migraciones nuevas.

### Archivos a tocar

- `src/components/classroom/CommentsAndReactions.tsx`: agregar estado de edición, mutaciones `updateComment` y `deleteComment`, menú de acciones por comentario, dialog de confirmación, y consulta para saber si el usuario actual es docente dueño de la asignación.

### Validación

- Probar como docente, como representante (acting student), y como usuario escolar:
  - Editar solo el propio.
  - Eliminar el propio en todos los roles.
  - Docente puede borrar comentario de un estudiante.