const express = require('express');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');
const { mapPurchaseRequest } = require('../helpers/mappers');
const { generateId } = require('../helpers/crud');

const J = (v) => JSON.stringify(v);
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT * FROM IntranetPurchaseRequests ORDER BY CreatedAt DESC');
    res.json(result.recordset.map(mapPurchaseRequest));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetPurchaseRequests WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'No encontrado' });
    res.json(mapPurchaseRequest(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const pr = req.body;
    const id = pr.id || generateId('PR');
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('title', sql.VarChar, pr.title || '')
      .input('items', sql.NVarChar, J(pr.items || []))
      .input('totalAmount', sql.Decimal, pr.totalAmount || 0)
      .input('justification', sql.NVarChar, pr.justification || '')
      .input('department', sql.VarChar, pr.department)
      .input('requestedBy', sql.VarChar, pr.requestedBy)
      .input('status', sql.VarChar, pr.status || 'Pendiente')
      .input('approvalLevel', sql.VarChar, pr.approvalLevel || 'Jefe Directo')
      .input('notes', sql.NVarChar, pr.notes || '')
      .input('quotationFiles', sql.NVarChar, J(pr.quotationFiles || []))
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO IntranetPurchaseRequests 
        (Id, Title, Items, TotalAmount, Justification, Department, RequestedBy, Status, ApprovalLevel, Notes, QuotationFiles, CreatedAt)
        VALUES (@id, @title, @items, @totalAmount, @justification, @department, @requestedBy, @status, @approvalLevel, @notes, @quotationFiles, @createdAt)
      `);
    const created = await pool.request().input('id', sql.VarChar, id)
      .query('SELECT * FROM IntranetPurchaseRequests WHERE Id = @id');
    res.status(201).json(mapPurchaseRequest(created.recordset[0]));
  } catch (err) {
    console.error('Create PR error:', err);
    res.status(500).json({ message: 'Error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    const pr = req.body;
    const request = pool.request().input('id', sql.VarChar, req.params.id);
    const sets = ['UpdatedAt = GETDATE()'];

    if (pr.status) { request.input('status', sql.VarChar, pr.status); sets.push('Status = @status'); }
    if (pr.notes !== undefined) { request.input('notes', sql.NVarChar, pr.notes); sets.push('Notes = @notes'); }
    if (pr.managerApproval !== undefined) { request.input('ma', sql.NVarChar, J(pr.managerApproval)); sets.push('ManagerApproval = @ma'); }
    if (pr.gmApproval !== undefined) { request.input('ga', sql.NVarChar, J(pr.gmApproval)); sets.push('GmApproval = @ga'); }
    if (pr.rejectionReason) { request.input('rr', sql.NVarChar, pr.rejectionReason); sets.push('RejectionReason = @rr'); }
    if (pr.rejectedBy) { request.input('rb', sql.VarChar, pr.rejectedBy); sets.push('RejectedBy = @rb'); }

    await request.query(`UPDATE IntranetPurchaseRequests SET ${sets.join(', ')} WHERE Id = @id`);
    const updated = await pool.request().input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetPurchaseRequests WHERE Id = @id');
    res.json(mapPurchaseRequest(updated.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/purchase-requests/:id/approve
router.post('/:id/approve', auth, async (req, res) => {
  try {
    const pool = getPool();
    const { by, comment, level } = req.body;
    const approval = J({ by, at: new Date().toISOString(), approved: true, comment });

    const request = pool.request().input('id', sql.VarChar, req.params.id);
    if (level === 'Gerencia General') {
      request.input('approval', sql.NVarChar, approval);
      await request.query("UPDATE IntranetPurchaseRequests SET GmApproval = @approval, Status = 'Aprobada', UpdatedAt = GETDATE() WHERE Id = @id");
    } else {
      request.input('approval', sql.NVarChar, approval);
      await request.query("UPDATE IntranetPurchaseRequests SET ManagerApproval = @approval, Status = 'Aprobada Jefe', UpdatedAt = GETDATE() WHERE Id = @id");
    }

    const updated = await pool.request().input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetPurchaseRequests WHERE Id = @id');
    res.json(mapPurchaseRequest(updated.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/purchase-requests/:id/reject
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const pool = getPool();
    const { by, reason } = req.body;
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .input('reason', sql.NVarChar, reason)
      .input('by', sql.VarChar, by)
      .query("UPDATE IntranetPurchaseRequests SET Status = 'Rechazada', RejectionReason = @reason, RejectedBy = @by, UpdatedAt = GETDATE() WHERE Id = @id");
    const updated = await pool.request().input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetPurchaseRequests WHERE Id = @id');
    res.json(mapPurchaseRequest(updated.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.VarChar, req.params.id)
      .query('DELETE FROM IntranetPurchaseRequests WHERE Id = @id');
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;
