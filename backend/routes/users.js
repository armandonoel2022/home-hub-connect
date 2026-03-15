const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');
const { mapUser } = require('../helpers/mappers');

const router = express.Router();

// GET /api/users
router.get('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT * FROM IntranetUsuarios ORDER BY FullName');
    res.json(result.recordset.map(mapUser));
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo usuarios' });
  }
});

// GET /api/users/birthdays/today
router.get('/birthdays/today', auth, async (req, res) => {
  try {
    const pool = getPool();
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const result = await pool.request()
      .input('birthday', sql.VarChar, mmdd)
      .query("SELECT * FROM IntranetUsuarios WHERE Birthday = @birthday AND (EmployeeStatus IS NULL OR EmployeeStatus = 'Activo')");
    res.json(result.recordset.map(mapUser));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetUsuarios WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'No encontrado' });
    res.json(mapUser(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/users
router.post('/', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Solo administradores' });

    const pool = getPool();
    const u = req.body;
    const id = u.id || `USR-${Date.now().toString().slice(-6)}`;

    // Hash password if provided
    let passwordHash = null;
    if (u.password) {
      passwordHash = await bcrypt.hash(u.password, 10);
    }

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('fullName', sql.VarChar, u.fullName)
      .input('email', sql.VarChar, u.email || '')
      .input('department', sql.VarChar, u.department || '')
      .input('position', sql.VarChar, u.position || '')
      .input('birthday', sql.VarChar, u.birthday || '')
      .input('photoUrl', sql.VarChar, u.photoUrl || '')
      .input('allowedDepts', sql.NVarChar, JSON.stringify(u.allowedDepartments || []))
      .input('isAdmin', sql.Bit, u.isAdmin ? 1 : 0)
      .input('isDeptLeader', sql.Bit, u.isDepartmentLeader ? 1 : 0)
      .input('reportsTo', sql.VarChar, u.reportsTo || null)
      .input('extension', sql.VarChar, u.extension || '')
      .input('shift', sql.VarChar, u.shift || '')
      .input('team', sql.VarChar, u.team || '')
      .input('fleetPhone', sql.VarChar, u.fleetPhone || '')
      .input('passwordHash', sql.VarChar, passwordHash)
      .query(`
        INSERT INTO IntranetUsuarios 
        (Id, FullName, Email, Department, Position, Birthday, PhotoUrl, AllowedDepartments, IsAdmin, IsDepartmentLeader, ReportsTo, Extension, Shift, Team, FleetPhone, PasswordHash)
        VALUES 
        (@id, @fullName, @email, @department, @position, @birthday, @photoUrl, @allowedDepts, @isAdmin, @isDeptLeader, @reportsTo, @extension, @shift, @team, @fleetPhone, @passwordHash)
      `);

    const created = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT * FROM IntranetUsuarios WHERE Id = @id');
    res.status(201).json(mapUser(created.recordset[0]));
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Error creando usuario' });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    const u = req.body;
    const request = pool.request().input('id', sql.VarChar, req.params.id);

    const sets = ['UpdatedAt = GETDATE()'];
    const fieldMap = {
      fullName: { col: 'FullName', type: sql.VarChar },
      email: { col: 'Email', type: sql.VarChar },
      department: { col: 'Department', type: sql.VarChar },
      position: { col: 'Position', type: sql.VarChar },
      birthday: { col: 'Birthday', type: sql.VarChar },
      photoUrl: { col: 'PhotoUrl', type: sql.VarChar },
      isAdmin: { col: 'IsAdmin', type: sql.Bit },
      isDepartmentLeader: { col: 'IsDepartmentLeader', type: sql.Bit },
      reportsTo: { col: 'ReportsTo', type: sql.VarChar },
      extension: { col: 'Extension', type: sql.VarChar },
      shift: { col: 'Shift', type: sql.VarChar },
      team: { col: 'Team', type: sql.VarChar },
      fleetPhone: { col: 'FleetPhone', type: sql.VarChar },
      employeeStatus: { col: 'EmployeeStatus', type: sql.VarChar },
    };

    for (const [key, cfg] of Object.entries(fieldMap)) {
      if (u[key] !== undefined) {
        request.input(key, cfg.type, u[key]);
        sets.push(`${cfg.col} = @${key}`);
      }
    }

    if (u.allowedDepartments !== undefined) {
      request.input('allowedDepts', sql.NVarChar, JSON.stringify(u.allowedDepartments));
      sets.push('AllowedDepartments = @allowedDepts');
    }

    await request.query(`UPDATE IntranetUsuarios SET ${sets.join(', ')} WHERE Id = @id`);

    const updated = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetUsuarios WHERE Id = @id');
    res.json(mapUser(updated.recordset[0]));
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Error actualizando usuario' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Solo administradores' });
    const pool = getPool();
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('DELETE FROM IntranetUsuarios WHERE Id = @id');
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error eliminando usuario' });
  }
});

// POST /api/users/:id/offboard
router.post('/:id/offboard', auth, async (req, res) => {
  try {
    const pool = getPool();
    const { reason, notes } = req.body;
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .input('status', sql.VarChar, 'Inactivo')
      .input('reason', sql.VarChar, reason)
      .input('notes', sql.NVarChar, notes || '')
      .input('by', sql.VarChar, req.user.id)
      .input('date', sql.DateTime, new Date())
      .query(`
        UPDATE IntranetUsuarios SET 
          EmployeeStatus = @status, OffboardingReason = @reason,
          OffboardingNotes = @notes, OffboardingBy = @by, OffboardingDate = @date,
          UpdatedAt = GETDATE()
        WHERE Id = @id
      `);
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetUsuarios WHERE Id = @id');
    res.json(mapUser(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/users/:id/reactivate
router.post('/:id/reactivate', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query(`
        UPDATE IntranetUsuarios SET 
          EmployeeStatus = 'Activo', OffboardingReason = NULL,
          OffboardingNotes = NULL, OffboardingBy = NULL, OffboardingDate = NULL,
          UpdatedAt = GETDATE()
        WHERE Id = @id
      `);
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetUsuarios WHERE Id = @id');
    res.json(mapUser(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;
