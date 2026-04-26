# SafeOne Intranet API

API REST (Express.js + SQL Server) para la intranet SafeOne.

## ⚠️ Persistencia de datos (LEER PRIMERO)

Los datos se guardan como archivos JSON. La ubicación se controla con la
variable `DATA_DIR` en `.env`. **Debe apuntar a una carpeta FUERA del
proyecto** (recomendado: `C:\intranet-data`) para que actualizar el código
desde GitHub **NO borre** los datos.

- Default en Windows si no se define: `C:\intranet-data`
- Default en otros SO: `./data` (solo desarrollo, NO usar en producción)

Crear la carpeta una vez en el servidor:
```cmd
mkdir C:\intranet-data
```

## Despliegue en el Servidor

### Paso 1: Instalar Node.js
Descargar e instalar **Node.js v18+** desde https://nodejs.org

### Paso 2: Copiar el proyecto
Copiar esta carpeta `backend/` al servidor, por ejemplo `C:\safeone-api\`

### Paso 3: Instalar dependencias
```cmd
cd C:\safeone-api
npm install
```

### Paso 4: Crear las tablas en SQL Server
Abrir SQL Server Management Studio y ejecutar `sql/001-create-tables.sql`

### Paso 5: Configurar .env
```cmd
copy .env.example .env
notepad .env
```
Ajustar: contraseña SQL, IP del servidor para CORS, JWT secret.

### Paso 6: Insertar usuarios iniciales
```cmd
node seed.js
```

### Paso 7: Probar
```cmd
npm run dev
```
Verificar: http://localhost:3000/api/health

### Paso 8: Configurar el frontend
Crear `.env` en la raíz del proyecto React:
```
VITE_API_URL=http://192.168.1.X:3000/api
```
Luego: `npm run build` y servir la carpeta `dist/` desde IIS o similar.

### Paso 9: Instalar como servicio Windows
```cmd
npm install -g node-windows
node install-service.js
```

### Paso 10: Firewall
Abrir puerto 3000 en el firewall de Windows:
```cmd
netsh advfirewall firewall add rule name="SafeOne API" dir=in action=allow protocol=TCP localport=3000
```

## Estructura
```
backend/
├── server.js              # Entry point
├── config/database.js     # SQL Server connection
├── middleware/auth.js      # JWT auth
├── helpers/
│   ├── mappers.js         # SQL → JSON mappers
│   └── crud.js            # Generic CRUD factory
├── routes/                # 11 route modules
├── sql/                   # SQL scripts
├── seed.js                # Initial data
└── install-service.js     # Windows service
```
