# SafeOne Intranet — Guía de API Backend (SQL Server)

## Arquitectura

```
[Navegador] → [Vite React App] → [API REST (Express.js)] → [SQL Server]
                                          ↓
                                   JWT Authentication
```

## Requisitos del Servidor

- **Node.js** v18+ (descargar de https://nodejs.org)
- **SQL Server** (ya instalado)
- El API corre como servicio Windows o en IIS con iisnode

## Inicio Rápido

```bash
mkdir safeone-api
cd safeone-api
npm init -y
npm install express cors mssql jsonwebtoken bcryptjs dotenv
npm install -D nodemon
```

## Configuración (.env)

```env
PORT=3000
DB_SERVER=localhost
DB_NAME=SafeOneDB
DB_USER=sa
DB_PASSWORD=tu_password
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
JWT_SECRET=tu_clave_secreta_muy_larga_y_segura
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://192.168.1.X:8080
```

## Estructura del Proyecto

```
safeone-api/
├── .env
├── server.js              # Entry point
├── config/
│   └── database.js        # SQL Server connection pool
├── middleware/
│   ├── auth.js            # JWT verification
│   └── cors.js            # CORS config
├── routes/
│   ├── auth.js            # POST /api/auth/login, /logout, /me
│   ├── users.js           # CRUD /api/users
│   ├── tickets.js         # CRUD /api/tickets
│   ├── equipment.js       # CRUD /api/equipment
│   ├── vehicles.js        # CRUD /api/vehicles
│   ├── phones.js          # CRUD /api/phones
│   ├── armed-personnel.js # CRUD /api/armed-personnel
│   ├── notifications.js   # /api/notifications
│   ├── purchase-requests.js
│   ├── hiring-requests.js
│   └── minor-purchases.js
└── package.json
```

## Código Base

### server.js

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/phones', require('./routes/phones'));
app.use('/api/armed-personnel', require('./routes/armed-personnel'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/purchase-requests', require('./routes/purchase-requests'));
app.use('/api/hiring-requests', require('./routes/hiring-requests'));
app.use('/api/minor-purchases', require('./routes/minor-purchases'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Start
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeOne API running on port ${PORT}`);
  });
});
```

### config/database.js

```javascript
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

async function connectDB() {
  try {
    pool = await sql.connect(config);
    console.log('Connected to SQL Server');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
}

function getPool() {
  if (!pool) throw new Error('Database not connected');
  return pool;
}

module.exports = { connectDB, getPool, sql };
```

### middleware/auth.js

```javascript
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, isAdmin }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

module.exports = authMiddleware;
```

### routes/auth.js

```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = getPool();

    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query(`
        SELECT * FROM IntranetUsuarios 
        WHERE LOWER(Email) = LOWER(@email)
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const user = result.recordset[0];

    // Compare password hash
    // NOTA: Debes hashear las contraseñas al crear usuarios
    // const valid = await bcrypt.compare(password, user.PasswordHash);
    // Por ahora, contraseña simple para migración:
    if (password.toLowerCase() !== 'safeone') {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: user.Id, email: user.Email, isAdmin: user.IsAdmin },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Map SQL columns to frontend IntranetUser shape
    const frontendUser = mapUserToFrontend(user);

    res.json({ token, user: frontendUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /api/auth/me — Validate current token
router.get('/me', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.user.id)
      .query('SELECT * FROM IntranetUsuarios WHERE Id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(mapUserToFrontend(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Con JWT stateless no hay nada que invalidar en el servidor
  // Podrías agregar una blacklist si lo necesitas
  res.status(204).send();
});

// Helper: Map SQL Server columns to frontend interface
function mapUserToFrontend(row) {
  return {
    id: row.Id,
    fullName: row.FullName,
    email: row.Email || '',
    department: row.Department || '',
    position: row.Position || '',
    birthday: row.Birthday || '',
    photoUrl: row.PhotoUrl || '',
    allowedDepartments: JSON.parse(row.AllowedDepartments || '[]'),
    isAdmin: !!row.IsAdmin,
    isDepartmentLeader: !!row.IsDepartmentLeader,
    reportsTo: row.ReportsTo || '',
    extension: row.Extension || '',
    shift: row.Shift || '',
    team: row.Team || '',
  };
}

module.exports = router;
```

### routes/tickets.js (ejemplo CRUD completo)

```javascript
const express = require('express');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/tickets
router.get('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT * FROM IntranetTickets ORDER BY CreatedAt DESC
    `);
    res.json(result.recordset.map(mapTicket));
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo tickets' });
  }
});

// POST /api/tickets
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, priority, status, department, slaHours, slaDeadline } = req.body;
    const pool = getPool();
    const id = `TK-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('title', sql.VarChar, title)
      .input('description', sql.Text, description)
      .input('category', sql.VarChar, category)
      .input('priority', sql.VarChar, priority)
      .input('status', sql.VarChar, status || 'Abierto')
      .input('createdBy', sql.VarChar, req.user.id)
      .input('department', sql.VarChar, department)
      .input('createdAt', sql.DateTime, now)
      .input('updatedAt', sql.DateTime, now)
      .input('slaHours', sql.Int, slaHours)
      .input('slaDeadline', sql.DateTime, slaDeadline)
      .query(`
        INSERT INTO IntranetTickets (Id, Title, Description, Category, Priority, Status, CreatedBy, Department, CreatedAt, UpdatedAt, SlaHours, SlaDeadline)
        VALUES (@id, @title, @description, @category, @priority, @status, @createdBy, @department, @createdAt, @updatedAt, @slaHours, @slaDeadline)
      `);

    res.status(201).json({ id, title, description, category, priority, status: status || 'Abierto', createdBy: req.user.id, department, createdAt: now, updatedAt: now, slaHours, slaDeadline, attachments: [] });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ message: 'Error creando ticket' });
  }
});

// PUT /api/tickets/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const pool = getPool();

    // Build dynamic UPDATE query
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${columnMap[k] || k} = @${k}`)
      .join(', ');

    const request = pool.request().input('id', sql.VarChar, id);
    Object.entries(updates).forEach(([k, v]) => {
      request.input(k, v);
    });

    await request.query(`UPDATE IntranetTickets SET ${fields}, UpdatedAt = GETDATE() WHERE Id = @id`);
    res.json({ id, ...updates });
  } catch (err) {
    res.status(500).json({ message: 'Error actualizando ticket' });
  }
});

// DELETE /api/tickets/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('DELETE FROM IntranetTickets WHERE Id = @id');
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error eliminando ticket' });
  }
});

const columnMap = {
  title: 'Title',
  description: 'Description',
  category: 'Category',
  priority: 'Priority',
  status: 'Status',
  department: 'Department',
};

function mapTicket(row) {
  return {
    id: row.Id,
    title: row.Title,
    description: row.Description || '',
    category: row.Category,
    priority: row.Priority,
    status: row.Status,
    createdBy: row.CreatedBy,
    department: row.Department,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
    slaHours: row.SlaHours,
    slaDeadline: row.SlaDeadline,
    attachments: JSON.parse(row.Attachments || '[]'),
  };
}

module.exports = router;
```

## Configuración del Frontend

Una vez que el API esté corriendo, configura la variable de entorno en el frontend:

Crea un archivo `.env` en la raíz del proyecto React:

```env
VITE_API_URL=http://192.168.1.X:3000/api
```

El frontend automáticamente detectará la URL y usará el API en lugar de localStorage.

## Ejecutar como Servicio Windows

Instala `node-windows` para ejecutar el API como servicio:

```bash
npm install -g node-windows
```

Crea `install-service.js`:

```javascript
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'SafeOne Intranet API',
  description: 'API REST para la intranet SafeOne',
  script: 'C:\\safeone-api\\server.js',
  env: [
    { name: 'PORT', value: '3000' },
    { name: 'NODE_ENV', value: 'production' },
  ],
});

svc.on('install', () => svc.start());
svc.install();
```

## Migración de Datos desde localStorage

Script para migrar datos existentes de localStorage al SQL Server:

```javascript
// migrate.js — Ejecutar una vez desde el navegador o Node
async function migrateData() {
  const API = 'http://192.168.1.X:3000/api';
  
  // Login como admin
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tecnologia@safeone.com.do', password: 'safeone' }),
  });
  const { token } = await loginRes.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Migrar usuarios
  const users = JSON.parse(localStorage.getItem('safeone_all_users') || '[]');
  for (const user of users) {
    await fetch(`${API}/users`, { method: 'POST', headers, body: JSON.stringify(user) });
  }

  // Migrar tickets, equipos, vehículos, etc.
  const modules = [
    { key: 'safeone_tickets', endpoint: '/tickets' },
    { key: 'safeone_equipment', endpoint: '/equipment' },
    { key: 'safeone_vehicles', endpoint: '/vehicles' },
    { key: 'safeone_phones', endpoint: '/phones' },
    { key: 'safeone_personnel', endpoint: '/armed-personnel' },
  ];

  for (const { key, endpoint } of modules) {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    for (const item of data) {
      await fetch(`${API}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(item) });
    }
    console.log(`Migrated ${data.length} items from ${key}`);
  }

  console.log('Migration complete!');
}
```

## Checklist de Implementación

- [ ] Instalar Node.js en el servidor Windows
- [ ] Crear las tablas SQL (script ya proporcionado)
- [ ] Configurar el proyecto Express con las rutas
- [ ] Insertar usuarios iniciales en IntranetUsuarios
- [ ] Probar endpoints con Postman/Insomnia
- [ ] Configurar VITE_API_URL en el frontend
- [ ] Ejecutar migración de datos localStorage → SQL
- [ ] Instalar como servicio Windows
- [ ] Configurar firewall para puerto 3000
- [ ] Configurar CORS para la IP de la intranet

## Seguridad

- Las contraseñas deben hashearse con bcrypt al crear usuarios
- JWT expira en 8 horas (jornada laboral)
- CORS limitado a la IP del servidor de la intranet
- SQL Server accesible solo desde la VLAN interna
