## Diagnóstico

El header con breadcrumb (`PageHeader`) usa por defecto una misma imagen (`@/assets/network-tech.png`) — la del icono isométrico azul que ves en casi todos los roles.

El cambio que detectaste viene de **3 páginas del rol admin** que están sobreescribiendo ese default con una URL de Unsplash distinta (las fotos de libros / escritorio):

- `src/pages/admin/UsersList.tsx` (línea 444) — foto de libros
- `src/pages/admin/AdminUsersList.tsx` (línea 300) — foto distinta
- `src/pages/admin/SchoolsList.tsx` (línea 117) — foto de libros

El resto de páginas (school, representative, teacher) no pasan `imageUrl`, por eso muestran siempre el mismo icono.

## Cambio

Eliminar el prop `imageUrl="..."` de esas 3 páginas para que caigan en el default y todos los roles vean **la misma imagen** en el header.

No se toca:
- `PageHeader.tsx` (sigue aceptando `imageUrl` por si en el futuro alguna página específica lo necesita).
- Títulos, descripciones, ni breadcrumbs de esas páginas.
- Ninguna otra página.

## Resultado esperado

El bloque azul de breadcrumb se ve idéntico para admin, colegio, representante y docente: mismo icono isométrico a la derecha, mismas tipografías y colores.
