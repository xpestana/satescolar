
## Plan: SAT Escolar - Módulo de Autenticación y Gestión de Colegios

### 🎨 Diseño General
Seguiremos el estilo visual de las imágenes de referencia:
- **Colores principales**: Azul corporativo (#1e3a5f aprox.), fondos claros
- **Layout**: Sidebar a la derecha con logo SAT Escolar, contenido principal a la izquierda
- **Cards de métricas**: Estilo colorido con íconos distintivos
- **Headers de sección**: Con imagen decorativa y breadcrumbs

---

### 1. 🔐 Sistema de Autenticación

**Página de Login**
- Diseño dividido: imagen futurista de ciudad a la izquierda, formulario a la derecha
- Logo SAT Escolar con texto "Bienvenido a SAT Escolar"
- Campos: Correo electrónico, Contraseña (con toggle de visibilidad)
- Checkbox "Recordarme"
- Enlace "¿Olvidó su contraseña?"
- Botón azul "Iniciar Sesión"

**Recuperación de Contraseña**
- Formulario para ingresar email
- Envío de enlace de recuperación

**Sistema de Roles**
- Tabla separada `user_roles` con enum: `admin`, `school`, `representative`
- Políticas RLS para cada rol
- Usuario inicial: admin@email.com / usuario12345

---

### 2. 📊 Dashboard Administrativo

**Tarjetas de métricas** (estilo colorido como las imágenes):
- Total de Colegios registrados
- Total de Usuarios del sistema
- Total de Eventos programados
- Total de Estudiantes

**Sidebar de navegación** (a la derecha):
- Logo SAT Escolar
- Dashboard (activo, resaltado en azul)
- **REGISTROS ADMIN**: Usuarios, Colegios
- **ÁREA DE REGISTROS**: Familias
- **ÁREA ADMINISTRATIVA**: Pagos
- **ÁREA DE GESTIÓN DEL COLEGIO**: Ajustes
- Footer con avatar del usuario, nombre y botón de cerrar sesión

---

### 3. 🏫 Gestión de Colegios

**Listado de Colegios**
- Header con título "Colegios", breadcrumbs e imagen decorativa
- Botón "Agregar Colegio" (azul con ícono)
- Tabla con columnas: Nombre, Dirección, Teléfono, Email, Acciones
- Paginación y búsqueda

**Formulario de Creación/Edición**
- Zona de carga de imagen/logo del colegio (drag & drop)
- **Campos obligatorios**:
  - Nombre de la institución
  - Teléfono de la institución
  - Dirección de la institución
  - Código DEA de la institución
  - Correo electrónico de la institución
  - URL de la institución
  - Código Estadístico de la institución
  - RIF de la institución
  - Tipo de institución (selector)
  - Fax de la institución
- **Ubicación geográfica** (selects dependientes con datos de Venezuela):
  - Estado → Municipio → Ciudad → Parroquia
- Botones: Guardar, Volver

---

### 4. 🗄️ Base de Datos (Supabase)

**Tablas a crear:**
- `profiles` - Datos de usuario (nombre, avatar)
- `user_roles` - Roles separados por seguridad
- `schools` - Información completa de colegios
- `venezuela_locations` - Estados, municipios, ciudades, parroquias

**Políticas de seguridad:**
- Solo admin puede crear/editar colegios
- Solo admin puede asignar roles
- Usuarios solo ven datos de su colegio asignado

---

### 5. 🔄 Flujo de Usuario (Admin)

1. Inicia sesión con credenciales
2. Ve el dashboard con métricas generales
3. Navega a "Colegios" en el sidebar
4. Ve listado de colegios existentes
5. Puede crear nuevo colegio con todos los datos requeridos
6. Los selects de ubicación se filtran automáticamente (Estado → Municipio → Ciudad → Parroquia)

---

**Nota**: Este es el primer módulo. En fases posteriores se implementarán: gestión de usuarios escolares, familias, estudiantes, pagos, eventos, y funcionalidades específicas por rol.
