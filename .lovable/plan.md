

# Plan de Correcciones

## Resumen de Problemas

1. **Año Escolar**: Solo muestra "No se puede eliminar" pero debería poder editarse
2. **Secciones**: El input debería solo aceptar una letra (restringir a nivel de input)
3. **Formularios**: El modal no se muestra porque hay una discrepancia en las URLs

## Problema Principal de Formularios

La navegación usa URLs en español (`representantes`, `estudiantes`) pero el código valida en inglés (`representative`, `student`). Por eso la página siempre redirige y nunca muestra el modal.

## Cambios Propuestos

### 1. Habilitar Edición de Año Escolar (`SchoolYearsSections.tsx`)

- Agregar estado `editingYearId` y `editingYearRange` para controlar la edición
- Agregar mutación para actualizar el año escolar
- Reemplazar "No se puede eliminar" con un botón de editar
- Mostrar un modal o input inline para editar el año

### 2. Restringir Input de Secciones a Una Letra (`SchoolYearsSections.tsx`)

- Cambiar el `Input` para que tenga:
  - `maxLength={1}` - Solo permite un carácter
  - Transformación automática a mayúscula en el `onChange`
  - Patrón de validación visual
- Esto previene la entrada de más de una letra desde el principio

### 3. Corregir URLs de Formularios

**Opción A (Recomendada)**: Cambiar FormBuilder para usar las rutas en inglés
- Cambiar las navegaciones a `/school/configuraciones/formularios/representative` y `/school/configuraciones/formularios/student`

**Opción B**: Cambiar FormFieldsEditor para aceptar las rutas en español
- Mapear `representantes` -> `representative` y `estudiantes` -> `student`

Usaremos la Opción B porque mantiene URLs amigables en español para los usuarios.

---

## Detalles Técnicos

### Archivo: `src/pages/school/SchoolYearsSections.tsx`

**Edición de Año Escolar:**
```typescript
// Agregar estados
const [editingYearId, setEditingYearId] = useState<string | null>(null);
const [editingYearRange, setEditingYearRange] = useState("");

// Agregar mutación de actualización
const updateYearMutation = useMutation({
  mutationFn: async ({ id, yearRange }: { id: string; yearRange: string }) => {
    const { error } = await supabase
      .from("school_years")
      .update({ year_range: yearRange })
      .eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["school-years"] });
    setEditingYearId(null);
    toast({ title: "Año escolar actualizado" });
  },
});

// En la tabla, cambiar el span por un botón de editar
<Button variant="ghost" size="icon" onClick={() => startEditingYear(year)}>
  <Edit className="h-4 w-4" />
</Button>
```

**Restringir Input de Sección:**
```typescript
<Input
  placeholder="Ej: A"
  value={newSectionName}
  onChange={(e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    setNewSectionName(value);
  }}
  maxLength={1}
  className="text-center uppercase"
/>
```

### Archivo: `src/pages/school/FormFieldsEditor.tsx`

**Mapeo de URLs español a inglés:**
```typescript
// Después de obtener el type de useParams
const { type } = useParams<{ type: string }>();

// Mapear las rutas en español a los valores en inglés
const typeMapping: Record<string, FormType> = {
  "representantes": "representative",
  "representative": "representative",
  "estudiantes": "student", 
  "student": "student",
};

const formType = typeMapping[type || ""] || null;
const isValidType = formType === "representative" || formType === "student";
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/school/SchoolYearsSections.tsx` | Agregar edición de año escolar + restringir input de secciones |
| `src/pages/school/FormFieldsEditor.tsx` | Agregar mapeo de URLs español/inglés |

