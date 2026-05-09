## Problema

El bloque de breadcrumb (PageHeader) muestra imágenes distintas según la página/rol:

- La mayoría de páginas usan la imagen por defecto `@/assets/network-tech.png` (la isométrica azul correcta).
- 3 páginas de admin pasan un `imageUrl` propio con fotos de Unsplash, lo que hace que el header se vea diferente:
  - `src/pages/admin/UsersList.tsx` (línea 444) — foto de libros
  - `src/pages/admin/SchoolsList.tsx` (línea 117) — foto de libros
  - `src/pages/admin/AdminUsersList.tsx` (línea 300) — foto de escritorio

## Cambios

1. Eliminar la prop `imageUrl="..."` de esas 3 páginas para que caigan al default `network-tech.png`. Así todos los roles (admin, colegio, representante, docente) verán exactamente la misma imagen en el breadcrumb.

2. No se modifica `PageHeader.tsx` (sigue aceptando `imageUrl` opcional por compatibilidad, simplemente nadie lo sobreescribe).

3. No se tocan títulos, descripciones, ni layout.

## Sobre el preview en blanco

El replay muestra que la sesión está en `/login` y no hay logs ni errores de consola registrados, así que no hay evidencia de un crash real. El preview en blanco suele deberse al proxy `lovable.js` interfiriendo con requests de auth en el iframe de preview. Recomendación: probar en la URL publicada / hacer hard reload. Si tras el cambio sigue en blanco con errores reales, lo revisamos con logs concretos — pero no haré cambios especulativos al runtime sin una señal de error.

## Archivos a editar

- `src/pages/admin/UsersList.tsx`
- `src/pages/admin/SchoolsList.tsx`
- `src/pages/admin/AdminUsersList.tsx`
