const express = require('express');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');
const { mapHiringRequest } = require('../helpers/mappers');
const { generateId } = require('../helpers/crud');

const J = (v) => JSON.stringify(v);
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT * FROM IntranetHiringRequests ORDER BY CreatedAt DESC');
    res.json(result.recordset.map(mapHiringRequest));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetHiringRequests WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'No encontrado' });
    res.json(mapHiringRequest(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const hr = req.body;
    const id = hr.id || generateId('HR');
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('position', sql.VarChar, hr.positionTitle)
      .input('department', sql.VarChar, hr.department)
      .input('justification', sql.NVarChar, hr.justification || '')
      .input('salaryRange', sql.VarChar, hr.salaryRange || '')
      .input('contractType', sql.VarChar, hr.contractType || 'Indefinido')
      .input('urgency', sql.VarChar, hr.urgency || 'Normal')
      .input('requirements', sql.NVarChar, hr.requirements || '')
      .input('hasVehicle', sql.Bit, hr.hasVehicle ? 1 : 0)
      .input('vehicleType', sql.VarChar, hr.vehicleType || '')
      .input('residentialZone', sql.VarChar, hr.residentialZone || '')
      .input('requestedBy', sql.VarChar, hr.requestedBy)
      .input('status', sql.VarChar, hr.status || 'Pendiente Gerente Área')
      .input('notes', sql.NVarChar, hr.notes || '')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO IntranetHiringRequests 
        (Id, Position, Department, Justification, SalaryRange, ContractType, Urgency, Requirements, HasVehicle, VehicleType, ResidentialZone, RequestedBy, Status, Notes, CreatedAt)
        VALUES (@id, @position, @department, @justification, @salaryRange, @contractType, @urgency, @requirements, @hasVehicle, @vehicleType, @residentialZone, @requestedBy, @status, @notes, @createdAt)
      `);
    const created = await pool.request().input('id', sql.VarChar, id)
      .query('SELECT * FROM IntranetHiringRequests WHERE Id = @id');
    res.status(201).json(mapHiringRequest(created.recordset[0]));
  } catch (err) {
    console.error('Create HR error:', err);
    res.status(500).json({ message: 'Error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    const hr = req.body;
    const request = pool.request().input('id', sql.VarChar, req.params.id);
    const sets = ['UpdatedAt = GETDATE()'];

    if (hr.status) { request.input('status', sql.VarChar, hr.status); sets.push('Status = @status'); }
    if (hr.notes !== undefined) { request.input('notes', sql.NVarChar, hr.notes); sets.push('Notes = @notes'); }
    if (hr.interviewDate) { request.input('intDate', sql.DateTime, hr.interviewDate); sets.push('InterviewDate = @intDate'); }
    if (hr.interviewNotes !== undefined) { request.input('intNotes', sql.NVarChar, hr.interviewNotes); sets.push('InterviewNotes = @intNotes'); }

    await request.query(`UPDATE IntranetHiringRequests SET ${sets.join(', ')} WHERE Id = @id`);
    const updated = await pool.request().input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetHiringRequests WHERE Id = @id');
    res.json(mapHiringRequest(updated.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// PUT /api/hiring-requests/:id/status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const pool = getPool();
    const { status, by, comment } = req.body;
    const request = pool.request().input('id', sql.VarChar, req.params.id);
    request.input('status', sql.VarChar, status);

    const sets = ['Status = @status', 'UpdatedAt = GETDATE()'];

    if (status.includes('Aprobada Gerente')) {
      request.input('ma', sql.NVarChar, J({ by, at: new Date().toISOString(), approved: true }));
      sets.push('ManagerApproval = @ma');
    } else if (status.includes('Aprobada Gerencia General')) {
      request.input('ga', sql.NVarChar, J({ by, at: new Date().toISOString(), approved: true }));
      sets.push('GmApproval = @ga');
    } else if (status === 'Rechazada') {
      request.input('rr', sql.NVarChar, comment || '');
      request.input('rb', sql.VarChar, by);
      sets.push('RejectionReason = @rr', 'RejectedBy = @rb');
    }

    await request.query(`UPDATE IntranetHiringRequests SET ${sets.join(', ')} WHERE Id = @id`);
    const updated = await pool.request().input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetHiringRequests WHERE Id = @id');
    res.json(mapHiringRequest(updated.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.VarChar, req.params.id)
      .query('DELETE FROM IntranetHiringRequests WHERE Id = @id');
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;
