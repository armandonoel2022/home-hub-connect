# SafeOne Intranet Corporativa

Sistema de intranet corporativa para **SafeOne Security Company**, diseñado para centralizar la gestión operativa, administrativa y tecnológica de la empresa.

## 🏢 Módulos

### Dashboard
- Vista general con tarjetas por departamento
- Información dinámica de líderes de departamento
- Sección expandible de equipo de trabajo y jerarquía de reportes
- Anuncios corporativos y cumpleaños del día
- Accesos rápidos a recursos internos

### Tickets IT
- Creación y seguimiento de tickets de soporte técnico
- Categorías: Red, Asignación de Equipos, Instalación de Software, Impresión, Flotas, etc.
- Prioridades con SLA automático (Baja: 72h, Media: 24h, Alta: 8h, Crítica: 2h)
- Estados: Abierto → En Progreso → En Espera → Resuelto → Cerrado

### Inventario IT
- Registro de equipos: computadoras, monitores, impresoras, equipos de red
- Control de estados: Disponible, Asignado, En Reparación, Dado de Baja
- Asignación por usuario y departamento

### Flotilla Vehicular
- Gestión de vehículos corporativos
- Seguimiento de kilometraje, estado y asignación
- Historial de mantenimiento

### Flota Celular
- Control de dispositivos móviles corporativos
- Registro de IMEI, número telefónico y asignación
- Estados de dispositivo y seguimiento

### Personal Armado (BASC)
- Registro de personal con armas asignadas
- Control de licencias y fechas de vencimiento
- Información de armamento: tipo, serial, marca, calibre

### Solicitudes de Compra
- Flujo de aprobación por monto (hasta RD$50k → Jefe Directo, superior → Gerencia General)
- Adjuntos de cotizaciones
- Estados: Pendiente → En Revisión → Aprobada/Rechazada

### Solicitudes de Personal
- Requisiciones de contratación con flujo de aprobación multinivel
- Aprobación por Gerente de Área → Gerencia General → RRHH
- Seguimiento de entrevistas y estado del proceso

### Gestión de Usuarios (Admin)
- CRUD de usuarios del sistema
- Asignación de departamentos y permisos
- Configuración de líderes de departamento y jerarquía de reportes

## 🔔 Notificaciones
- Sistema de notificaciones en tiempo real en el sidebar
- Alertas para aprobaciones pendientes, tickets y solicitudes

## 🔐 Autenticación
- Login por correo o nombre de usuario
- Control de acceso por departamento
- Roles: Administrador y Usuario estándar

## 🛠 Stack Tecnológico

| Tecnología | Uso |
|---|---|
| React 18 | Framework UI |
| TypeScript | Tipado estático |
| Vite | Build tool |
| Tailwind CSS | Estilos utilitarios |
| shadcn/ui | Componentes UI |
| React Router | Navegación SPA |
| Recharts | Gráficos y visualizaciones |
| Lucide React | Iconografía |

## 📁 Estructura del Proyecto

```
src/
├── assets/          # Imágenes y recursos estáticos
├── components/      # Componentes reutilizables
│   └── ui/          # Componentes base (shadcn/ui)
├── contexts/        # Contextos React (Auth, Notifications)
├── hooks/           # Hooks personalizados
├── lib/             # Utilidades, tipos y datos mock
└── pages/           # Páginas/vistas principales
```

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## 📋 Departamentos

- Administración
- Gerencia General
- Gerencia Comercial
- Recursos Humanos
- Operaciones
- Servicio al Cliente
- Calidad
- Cuentas por Cobrar
- Contabilidad
- Tecnología y Monitoreo
- Seguridad Electrónica

---

**SafeOne Security Company** — Departamento de Tecnología y Monitoreo
