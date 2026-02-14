

# Acciones en Busqueda Avanzada + Carnet con QR

## Resumen
Agregar una columna de acciones a las tablas de estudiantes y representantes en la busqueda avanzada con botones de Ver, Editar y Descargar Carnet. Tambien corregir la navegacion en el modal de familia para usar recargas completas y evitar errores de estado.

## Cambios a realizar

### 1. Columna de acciones en la tabla de busqueda avanzada
Agregar una columna fija "Acciones" (no movible, no ocultable) al inicio o final de cada fila con tres botones:

- **Ver (Eye)**: Abre un modal con los datos de la familia + datos del estudiante/representante seleccionado. Muestra los datos de familia (apellidos, email, telefono, direccion, status) y debajo los datos del integrante segun las columnas activas (o todos los campos de form_data).
- **Editar (Edit)**: Navega a la pagina de edicion del estudiante o representante usando `window.location.href` para forzar recarga completa y evitar problemas de estado React.
- **Carnet (IdCard)**: Genera y descarga un PDF con formato de carnet.

### 2. Modal "Ver" detalle
Un nuevo componente `ViewRecordModal` que recibe el registro y muestra:
- Seccion "Datos de Familia": apellidos, email, telefono, direccion, status
- Seccion "Datos del Estudiante/Representante": campos del form_data + campos fijos (cedula, foto, etc.)
- Boton para editar (lleva a la pagina de edicion con recarga)

### 3. Corregir navegacion en ViewFamilyModal
Cambiar los `navigate()` en `ViewFamilyModal.tsx` por `window.location.href` para:
- `handleEditFamily`
- `handleEditStudent`
- `handleEditRepresentative`
- `handleAddStudent`
- `handleAddRepresentative`

Esto fuerza una recarga completa de la pagina y evita los errores de estado stale que ocurren con la navegacion SPA.

### 4. Generacion de carnet PDF con QR
Crear una funcion `downloadCarnet` en `export-utils.ts` que genera un PDF con tamano de carnet estandar (85.6mm x 53.98mm - tamano ISO/IEC 7810 ID-1, como una tarjeta de credito):

**Diseno del carnet (basado en la imagen de referencia):**
- Fondo blanco con borde redondeado decorativo
- Franja superior con color institucional (azul)
- Logo del colegio centrado en la franja
- Nombre de la institucion
- Ubicacion (ciudad, estado)
- Ano escolar activo
- Numero de cedula
- Foto del estudiante/representante (circular)
- Nombre completo en mayusculas
- Tipo: "ESTUDIANTE" o "REPRESENTANTE"
- Codigo QR (por ahora un cuadrado placeholder vacio, listo para ser reemplazado)

**Nombre del archivo:** `Carnet_{Nombre_Completo}.pdf`

### 5. Obtener ano escolar activo
Para el carnet se necesita el ano escolar activo. Se hace un query a `school_years` filtrando por `school_id` y `is_active = true`.

---

## Detalles Tecnicos

### Archivos a crear
- `src/components/search/ViewRecordModal.tsx` - Modal de vista detallada

### Archivos a modificar
- `src/pages/school/AdvancedSearch.tsx` - Agregar columna acciones, estados para modal y logica de carnet
- `src/lib/export-utils.ts` - Nueva funcion `downloadCarnet`
- `src/components/families/ViewFamilyModal.tsx` - Cambiar navigate por window.location.href

### Estructura de la columna de acciones

```text
| ... columnas existentes ... | Acciones          |
|                             | [Eye] [Edit] [ID] |
```

Los botones de accion seran iconos con tooltips.

### Funcion downloadCarnet

```typescript
export async function downloadCarnet(params: {
  personName: string;
  documentId: string;
  role: "ESTUDIANTE" | "REPRESENTANTE";
  photoUrl?: string;
  schoolName: string;
  schoolLocation: string;
  schoolLogoUrl?: string;
  schoolYear: string;
}) { ... }
```

El carnet se genera con jsPDF en tamano personalizado (85.6 x 53.98 mm). El codigo QR sera un rectangulo vacio con borde por ahora.

### Navegacion con recarga

```typescript
// Antes (causa errores de estado)
navigate(`/registros/familias/${familyId}/editar`);

// Despues (recarga completa)
window.location.href = `/registros/familias/${familyId}/editar`;
```

### Datos para el modal "Ver"
Se reutiliza el registro ya cargado en la tabla + se hace fetch de la familia completa para mostrar datos adicionales (email, telefono, direccion).

