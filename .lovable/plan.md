

# Plan: Corregir gestión de familias y roles

## Problema raíz

La edge function `create-family` tiene dos bugs principales:

1. **No valida el rol del usuario existente**: Si se crea una familia con un correo que ya pertenece a un usuario con rol `school` (el admin del colegio), la función crea un registro en `families` vinculado al `user_id` del admin. Esta familia queda "fantasma" porque el listado filtra por rol `representative`.

2. **No impide crear familias duplicadas para el mismo user_id**: Si el usuario ya existe y NO tiene familia, crea una nueva sin verificar que el usuario tenga un rol compatible.

Esto explica por qué solo ves 1 familia cuando debería haber más: las familias creadas con correos de usuarios `school` quedan ocultas pero ocupan espacio en la base de datos.

## Paso 1: Diagnosticar datos actuales

Ejecutar consultas SQL para identificar:
- Familias vinculadas a usuarios con rol distinto a `representative`
- Usuarios con rol `representative` que NO tienen registro en `families`
- Familias sin asociación en `family_schools`
- Estudiantes huérfanos (sin familia válida)

## Paso 2: Reparar datos existentes

Script SQL para:
- Eliminar registros `family_schools` y `families` vinculados a usuarios con rol `school` o `admin` (son familias fantasma creadas por error)
- Verificar que cada usuario `representative` tenga exactamente un registro en `families` y su correspondiente `family_schools`

## Paso 3: Corregir la edge function `create-family`

Modificar `supabase/functions/create-family/index.ts`:

- **Validar rol del usuario existente**: Si el email ya pertenece a un usuario con rol `school`, `admin` o `teacher`, rechazar la operación con un mensaje claro: "Este correo pertenece a una cuenta administrativa. Use un correo diferente."
- **Evitar duplicados**: Verificar que no se cree un segundo registro `families` para el mismo `user_id`

Cambio clave en la lógica (pseudocódigo):
```text
Si el usuario ya existe:
  Si tiene rol != representative → ERROR "correo pertenece a cuenta administrativa"
  Si ya tiene familia en este colegio → ERROR "ya existe"
  Si tiene familia pero no en este colegio → asociar familia existente
  Si NO tiene familia → crear familia + asociar
Si el usuario no existe:
  Crear usuario + rol representative + familia + asociar
```

## Paso 4: Corregir el conteo de paginación en FamiliesList

En `src/pages/school/FamiliesList.tsx`, el `count` devuelto por la query paginada incluye familias de usuarios no-representative. El filtro `.filter(f => repUserIds.has(f.user_id))` en el cliente reduce la lista pero el `count` sigue siendo el total sin filtrar.

**Solución**: Cambiar la query paginada para que use los `familyIds` ya filtrados del `globalCounts` query, o hacer la query en dos pasos (primero obtener IDs válidos, luego paginar sobre esos IDs).

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/create-family/index.ts` | Validar rol del usuario existente antes de crear familia |
| `src/pages/school/FamiliesList.tsx` | Corregir conteo de paginación para excluir familias fantasma |
| (SQL via psql) | Diagnosticar y limpiar datos corruptos |

## Orden de ejecución

1. Diagnosticar datos con `psql` (read-only)
2. Limpiar datos corruptos (script SQL)
3. Corregir edge function
4. Corregir paginación del listado

