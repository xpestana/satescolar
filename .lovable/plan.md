# Descripciones persuasivas en todos los breadcrumbs

## Objetivo
El componente `PageHeader` ya soporta descripciones, pero el diccionario actual cubre solo una parte de las páginas. La idea es extenderlo para que **todas** las pantallas que usan `PageHeader` (admin, school, teacher, representative) muestren una descripción persuasiva debajo del breadcrumb.

## Alcance
Un único archivo a modificar: `src/components/layout/PageHeader.tsx`.

No es necesario tocar las pantallas individualmente: el `PageHeader` resuelve la descripción automáticamente a partir del `title`. Cualquier pantalla podrá seguir sobreescribiendo con la prop opcional `description`.

## Cambios

### 1. Reemplazar el diccionario por una lista ordenada con coincidencia parcial
Hoy es un `Record<string, string>` con coincidencia parcial vía `Object.keys().find(...)`, pero el orden de claves no está garantizado. Se cambia a `Array<[string, string]>` para que las coincidencias más específicas aparezcan primero (por ejemplo "Editar Familia" antes que "Familia").

### 2. Cobertura completa de títulos
Añadir entradas para todas las páginas detectadas con `PageHeader title=`:

- **Admin**: Colegios, Crear/Editar Colegio, Usuarios, Administradores del Sistema, Enviar Email, Prueba de subida a S3.
- **School / Registros**: Docentes, Agregar/Editar Docente, Familias, Editar Familia, Agregar/Editar Representante, Agregar/Editar Estudiante, Estudiantes, Inscripciones, Búsqueda Avanzada.
- **School / Académico**: Áreas / Materias, Asignación de Áreas, Ajustes de Notas, Ajustes de Evaluación, Sábana de Notas, Consulta de Notas y Boletas, Supervisión de Aulas Virtuales, Configuraciones (Períodos y Secciones).
- **School / Administrativo**: Dashboard de Pagos, Registro de Pagos, Configuración de Pagos, Configuración de Morosidad, Estudiantes Morosos, Estado de Cuenta.
- **School / Asistencia**: Escáner QR, Asistencias.
- **School / Configuración**: Configuraciones - Formularios, Configuración de Planillas, Constructor de Planillas, Planillas, Usuarios y Permisos, Nuevo Usuario Escolar, Editar Usuario, Nuevo Perfil de Permiso, Editar Perfil, Utilidades, Carnets, Correos Electrónicos.
- **Teacher**: Mis Materias, Registro de Notas, Mi Carnet, Aula Virtual.
- **Representative**: Mis Estudiantes, Mis Representantes, Datos de Familia, Familia {nombre}, Aula Virtual — {estudiante}, Agregar/Editar Representante, Agregar/Editar Estudiante.

### 3. Coincidencia parcial robusta
La función `lookupDescription(title)` itera la lista en orden y devuelve la primera entrada cuyo key esté contenido en el `title`. Esto cubre títulos dinámicos como:
- `"Editar Familia - González"` → "Editar Familia".
- `"Aula Virtual — Juan Pérez"` → "Aula Virtual".
- `"Agregar Estudiante - Familia X"` → "Agregar Estudiante".
- `"Familia González"` → "Familia ".

### 4. Sin cambios visuales adicionales
- Se mantiene la imagen tecnológica de redes ya integrada.
- Se mantiene la prop opcional `description` por si una pantalla puntual quiere un copy distinto.
- Layout y estilos del header no cambian.

## Detalles técnicos
Archivo único: `src/components/layout/PageHeader.tsx`
- Cambiar `DESCRIPTIONS` de `Record<string,string>` a `Array<[string,string]>`.
- Reemplazar `getDescription` por `lookupDescription` con iteración ordenada (`title === key || title.includes(key)`).
- Añadir las entradas faltantes listadas arriba.
- No se modifican otros archivos del proyecto.

## Validación
- Recorrer mentalmente las rutas principales (`/registros/familias`, `/registros/docentes`, `/pagos`, `/configuraciones/usuarios`, `/teacher/materias`, `/representative/estudiantes`, etc.) y confirmar que cada `title` mapea a una descripción.
- Las páginas dashboard que usan `PageHeader` con títulos de tarjetas (StatCard) NO se ven afectadas porque ese componente es distinto a `PageHeader`.
