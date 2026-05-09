## Problema

En el VPS, al abrir **Registro de Representante** (rol representante), la app crashea con:

```
NotFoundError: Failed to execute 'removeChild' on 'Node':
The node to be removed is not a child of this node.
```

### Causa raíz

`index.html` declara `<html lang="en">` pero el contenido es español. **Chrome auto-traduce** la página al idioma del usuario, lo que muta nodos de texto del DOM. Cuando React intenta luego desmontar/actualizar esos nodos (especialmente dentro de Radix `Select`, portales y formularios dinámicos como `GroupedFormFields`), encuentra el árbol DOM modificado por el traductor y lanza `removeChild`. Por eso solo ocurre en producción/VPS (donde el navegador del usuario tiene idioma distinto a español) y no en el preview interno.

Es el bug clásico de "Google Translate + React". Los `translate="no"` puntuales que ya existen en algunos `SelectTrigger` confirman que ya se topó antes con el mismo síntoma, pero la cobertura es parcial.

### Segundo punto

El usuario pide que el formulario que se muestre sea exactamente el guardado en BD. Hoy `RepAddRepresentative` ya carga `existingRep.form_data` y los `form_fields` por `school_id`, pero conviene verificar que en modo edición no se rendericen fields antes de tener `form_data` (para evitar inputs "uncontrolled→controlled" — warning ya visible en consola, que también puede contribuir a inconsistencias).

## Cambios

### 1. Bloquear traducción automática del navegador (fix del crash)

**`index.html`**
- Cambiar `<html lang="en">` por `<html lang="es" translate="no">`.
- Añadir en `<head>`:
  - `<meta name="google" content="notranslate" />`
  - `<meta http-equiv="Content-Language" content="es" />`
- Añadir clase `notranslate` al `<body>` (defensa extra para extensiones de traducción).

Esto evita que Chrome/Edge/Safari muten el DOM bajo React y elimina el `removeChild`.

### 2. Garantizar que el formulario refleje lo guardado

**`src/pages/representative/RepAddRepresentative.tsx`**
- Mantener la lógica actual de cargar `existingRep.form_data`, pero asegurar que `<GroupedFormFields>` solo se monte cuando `isRepDataReady` sea `true` (ya está) **y** cuando `formFields.length > 0`. Si aún se están cargando, mostrar el skeleton — evita que los `Select` arranquen sin valor y luego cambien (causa del warning "uncontrolled to controlled" y de inconsistencias visuales).
- En el `onFieldChange`, conservar todos los campos persistidos en `form_data` aunque ya no estén en el form actual (no borrarlos al guardar). Hoy se hace `form_data: formData`, lo que sobrescribe; cambiar a `{ ...existingRep.form_data, ...formData }` en modo edición para no perder valores de campos ocultos/eliminados del builder.

### 3. Verificación

- Recargar `/representative/representante/nuevo` y `/representative/representante/:id` en el VPS con un navegador en idioma distinto a español → no debe aparecer el ErrorBoundary.
- Editar un representante existente → todos los campos guardados deben verse precargados con su valor exacto de BD.

## Detalles técnicos (para referencia)

- El crash NO está en código nuestro: `iee/_d/aee` minificados son las funciones internas de React DOM `removeChild`/`commitDeletionEffectsOnFiber`. Es siempre síntoma de mutación externa del DOM.
- `translate="no"` a nivel `<html>` es respetado por Chrome, Edge, Safari y la mayoría de extensiones (DeepL, etc.).
- No tocamos `PageHeader`, `DashboardLayout`, ni rutas.
