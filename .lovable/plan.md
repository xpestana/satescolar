## Cambio en `src/pages/school/EnrollmentsList.tsx` (línea ~830-836)

Actualmente el color de fondo de cada fila depende sólo de `completeness.isComplete` (campos requeridos llenos). Como muchos campos no son `required`, casi todos terminan en verde aunque el estudiante esté "Pendiente" de inscribir.

### Nueva lógica de color de fila

Combinar dos señales: estado de inscripción + completitud de datos.

| Inscrito | Datos completos | Color fila |
|----------|----------------|------------|
| Sí       | Sí             | Verde (`bg-green-50/60`) |
| Sí       | No             | Ámbar (`bg-amber-50/60 hover:bg-amber-100/60`) — inscrito pero faltan datos |
| No       | Sí             | Ámbar — datos listos pero falta inscribir |
| No       | No             | Rojo (`bg-red-50/60`) — pendiente y con datos faltantes |

Es decir: **verde sólo cuando ambas condiciones se cumplen**. Pendiente nunca es verde.

### Implementación

Reemplazar el bloque:

```ts
const rowBg = completeness
  ? completeness.isComplete
    ? "bg-green-50/60 hover:bg-green-100/60"
    : "bg-red-50/60 hover:bg-red-100/60"
  : "";
```

por:

```ts
const isComplete = completeness?.isComplete ?? true;
const rowBg = student.isEnrolled && isComplete
  ? "bg-green-50/60 hover:bg-green-100/60"
  : !student.isEnrolled && !isComplete
    ? "bg-red-50/60 hover:bg-red-100/60"
    : "bg-amber-50/60 hover:bg-amber-100/60";
```

No se tocan otras tablas/badges; el badge "Pendiente" / "Inscrito" sigue igual.