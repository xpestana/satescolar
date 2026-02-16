
# Plan: Area del Representante (Dashboard del Representante)

## Resumen
Crear el area completa para el usuario con rol `representative`, incluyendo su dashboard, gestion de representantes y estudiantes de su familia, edicion de datos familiares, y descarga de carnets. Ademas, configurar la contraseña del usuario de prueba `xpestana43@gmail.com` (que ya tiene rol representative) para que puedas ingresar y probar.

**Nota importante:** El correo `xpestana42@gmail.com` ya tiene rol `school`, asi que usare `xpestana43@gmail.com` (familia Zambrano Araujo) que ya es representante. Le asignare una contraseña conocida para tus pruebas.

---

## Funcionalidades a construir

### 1. Configuracion de usuario de prueba
- Usar una edge function para cambiar la contraseña de `xpestana43@gmail.com` a una contraseña conocida que te proporcionare al implementar

### 2. Redireccion por rol al iniciar sesion
- Modificar `ProtectedRoute.tsx` para redirigir al representante a `/representative/dashboard`
- Modificar `Login.tsx` para que al autenticarse con rol `representative` redirija a `/representative/dashboard`

### 3. Sidebar y Layout para el representante
- Agregar secciones de navegacion para `representative` en `AppSidebar.tsx`:
  - Inicio (Dashboard)
  - Mis Representantes
  - Mis Estudiantes
  - Datos de Familia
- En el footer del sidebar, mostrar el nombre de la familia en lugar del colegio

### 4. Dashboard del Representante (`/representative/dashboard`)
- Tarjetas con estadisticas:
  - Cantidad de representantes registrados en su familia
  - Cantidad de estudiantes registrados en su familia
  - Estudiantes inscritos en plantel (placeholder por ahora, valor 0)
- Alerta/recordatorio para mantener datos actualizados (como en la imagen de referencia)
- Seccion de cards de representantes con foto, nombre, tipo, badge (Principal/Secundario), y botones: Editar, Eliminar (si no es el unico), Descargar Carnet
- Seccion de cards de estudiantes con foto, nombre, documento, status, y botones: Editar, Eliminar, Descargar Carnet

### 5. Listado de Representantes (`/representative/representantes`)
- Cards con foto circular, nombre completo, tipo de representante, badge
- Botones: Agregar, Editar (redirige a la pagina existente de edicion), Eliminar, Descargar Carnet
- El boton "Volver" en la edicion regresa a esta vista

### 6. Listado de Estudiantes (`/representative/estudiantes`)
- Cards con foto, nombre, documento, status
- Botones: Agregar, Editar, Eliminar, Descargar Carnet
- El boton "Volver" en la edicion regresa a esta vista

### 7. Edicion de Datos de Familia (`/representative/datos-familia`)
- Reutiliza la logica de `EditFamily.tsx` pero sin `DashboardLayout` de school
- Usa el layout del representante
- El representante obtiene su `family_id` desde la tabla `families` con su `user_id`

### 8. Descarga de Carnet
- Reutilizar la funcion `downloadCarnet` existente con rol "REPRESENTANTE" o "ESTUDIANTE" segun corresponda
- Necesita obtener datos del colegio asociado via `family_schools` para el membrete

### 9. Rutas nuevas en App.tsx
- `/representative/dashboard` - Dashboard
- `/representative/representantes` - Listado de representantes  
- `/representative/estudiantes` - Listado de estudiantes
- `/representative/datos-familia` - Edicion de datos familiares
- `/representative/representante/nuevo` - Agregar representante
- `/representative/representante/:id/editar` - Editar representante
- `/representative/estudiante/nuevo` - Agregar estudiante
- `/representative/estudiante/:id/editar` - Editar estudiante

---

## Detalles tecnicos

### Archivos nuevos
- `src/pages/representative/RepresentativeDashboard.tsx` - Dashboard principal
- `src/pages/representative/RepresentativesList.tsx` - Listado de representantes en cards
- `src/pages/representative/StudentsList.tsx` - Listado de estudiantes en cards
- `src/pages/representative/EditFamilyData.tsx` - Edicion datos familia
- `src/pages/representative/AddEditRepresentative.tsx` - Wrapper que reutiliza logica de formulario
- `src/pages/representative/AddEditStudent.tsx` - Wrapper que reutiliza logica de formulario
- `src/hooks/useRepresentativeFamily.ts` - Hook para obtener family_id y school_id del representante logueado

### Archivos modificados
- `src/App.tsx` - Agregar rutas del representante
- `src/components/layout/AppSidebar.tsx` - Agregar navegacion para rol representative
- `src/components/auth/ProtectedRoute.tsx` - Agregar redireccion para representative
- `src/pages/Login.tsx` - Agregar redireccion post-login para representative
- `src/components/layout/DashboardLayout.tsx` - Soporte para representantes (sin sidebar de school)

### Base de datos
- No se requieren cambios de schema, las tablas y RLS ya soportan el rol representative (families tiene policy para `auth.uid() = user_id`, representatives y students tienen policies para familias del usuario)

### Hook useRepresentativeFamily
- Obtiene el `family_id` desde `families` where `user_id = auth.uid()`
- Obtiene el `school_id` desde `family_schools` para el membrete del carnet
- Cachea con react-query

### Formularios de representante y estudiante
- Los formularios de AddRepresentative y AddStudent ya existen y usan `schoolId` para obtener form_fields
- Para el area de representante, el `schoolId` se obtendra via `family_schools`
- Se ajustara la navegacion de "Volver" para que regrese al area de representantes, no al area de school
