

## Plan: Indicadores por defecto para Primaria

### Objetivo
Insertar automáticamente las 7 áreas y sus indicadores para cada grado (1°-6°) cuando se crea un colegio, y poblar los colegios existentes.

### Implementación

**1. Migración SQL** con:

- Una función `populate_default_primary_indicators(p_school_id uuid)` que inserta las 7 áreas (Desempeño estudiantil, Lenguaje Comunicación y Cultura, Matemática Ciencias Naturales y Sociedad, Ciencias Sociales Ciudadanía e Identidad, Educación Religiosa Escolar, Educación Física Deporte y Recreación, Informática) para cada grado `1` a `6`, y luego sus indicadores correspondientes vinculados por `area_id`.

- Modificar la función trigger existente `create_default_form_fields()` para que al final también llame a `populate_default_primary_indicators(NEW.id)`.

- Un bloque `DO` que ejecute la función para todos los colegios existentes que aún no tengan áreas de indicadores.

**2. Datos a insertar por área:**

| Área | # Indicadores |
|------|--------------|
| Desempeño estudiantil | 7 |
| Lenguaje Comunicación y Cultura | 12 |
| Matemática, Ciencias Naturales y Sociedad | 14 |
| Ciencias Sociales, Ciudadanía e Identidad | 8 |
| Educación Religiosa Escolar | 6 |
| Educación Física Deporte y Recreación | 4 |
| Informática | 5 |

Total: 56 indicadores × 6 grados = 336 indicadores + 42 áreas por colegio.

**3. Lógica de idempotencia**: La función verifica si ya existen áreas para ese colegio antes de insertar, evitando duplicados.

### Archivos afectados
| Archivo | Acción |
|---------|--------|
| Nueva migración SQL | Crear función + modificar trigger + seed |

No se requieren cambios en el frontend ya que el modal existente ya soporta visualizar y editar estas áreas e indicadores.

