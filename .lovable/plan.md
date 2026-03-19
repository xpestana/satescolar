

## Plan: Corregir snippets, carga de plantillas y firmas

### Problemas identificados

1. **Snippets con formato azul**: Se insertan con `<span>` con estilos (fondo azul, negrita). Deben insertarse como texto plano `{{variable}}` sin formato.

2. **Plantilla no carga en editor**: El `RichTextEditor` usa `dangerouslySetInnerHTML` solo en el render inicial. Cuando se cambia `value` externamente (al cargar plantilla), el `contentEditable` div no se actualiza porque React no re-renderiza contenido de un div `contentEditable`.

3. **Firma debe configurarse en el constructor**: Actualmente las líneas de firma se toman de `planilla_general_config`. Deben ser un campo editable dentro del constructor, guardadas junto con la plantilla.

### Cambios

#### 1. `RichTextEditor.tsx` — Soportar actualizaciones externas

- Agregar un `useEffect` que detecte cuando `value` cambia externamente (no por input del usuario) y actualice el `innerHTML` del div editable. Se usa un flag `isInternalChange` para evitar loops.

#### 2. `DocumentBuilder.tsx` — Snippets sin formato

- Cambiar `insertSnippet` para insertar texto plano `{{key}}` sin HTML de estilo (sin `<span>`, sin colores, sin fondo azul).

#### 3. `DocumentBuilder.tsx` — Firma configurable en el constructor

- Agregar un campo de "Líneas de firma" debajo del editor: input para agregar nombres de firmantes (ej: "Director(a)", "Representante"), con botón agregar/eliminar.
- Las firmas se guardan como parte de la plantilla en la tabla `document_templates`.
- Migración SQL: agregar columna `signature_lines text[] DEFAULT '{}'` a `document_templates`.
- Eliminar la dependencia de `planilla_general_config.signature_lines` para las firmas.

#### 4. `DocumentBuilder.tsx` — Carga de plantilla

- Al cargar plantilla, también cargar sus `signature_lines` al estado local.
- Al guardar, incluir `signature_lines` en el insert/update.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/utilities/RichTextEditor.tsx` | useEffect para sincronizar value externo |
| `src/components/utilities/DocumentBuilder.tsx` | Snippets sin formato, firma editable en UI, carga de plantilla |
| Migración SQL | Agregar `signature_lines` a `document_templates` |

