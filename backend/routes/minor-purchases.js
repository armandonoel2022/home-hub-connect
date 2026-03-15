const express = require('express');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');
const { mapMinorPurchase } = require('../helpers/mappers');
const { generateId } = require('../helpers/crud');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT * FROM IntranetMinorPurchases ORDER BY CreatedAt DESC');
    res.json(result.recordset.map(mapMinorPurchase));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const mp = req.body;
    const id = mp.id || generateId('MP');
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('description', sql.NVarChar, mp.description || '')
      .input('amount', sql.Decimal, mp.amount || 0)
      .input('paymentMethod', sql.VarChar, mp.paymentMethod || 'Caja Chica')
      .input('category', sql.VarChar, mp.category || '')
      .input('department', sql.VarChar, mp.department)
      .input('requestedBy', sql.VarChar, mp.requestedBy)
      .input('requestedByName', sql.VarChar, mp.requestedByName || '')
      .input('status', sql.VarChar, 'Pendiente')
      .input('assignedApprover', sql.VarChar, mp.assignedApprover || null)
      .input('receiptUrl', sql.VarChar, mp.receiptUrl || '')
      .input('notes', sql.NVarChar, mp.notes || '')
      .input('purchasedBy', sql.VarChar, mp.purchasedBy || '')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO IntranetMinorPurchases 
        (Id, Description, Amount, PaymentMethod, Category, Department, RequestedBy, RequestedByName, Status, AssignedApprover, ReceiptUrl, Notes, PurchasedBy, CreatedAt)
        VALUES (@id, @description, @amount, @paymentMethod, @category, @department, @requestedBy, @requestedByName, @status, @assignedApprover, @receiptUrl, @notes, @purchasedBy, @createdAt)
      `);
    const created = await pool.request().input('id', sql.VarChar, id)
      .query('SELECT * FROM IntranetMinorPurchases WHERE Id = @id');
    res.status(201).json(mapMinorPurchase(created.recordset[0]));
  } catch (err) {
    console.error('Create MP error:', err);
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/minor-purchases/:id/approve
router.post('/:id/approve', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .input('by', sql.VarChar, req.body.by)
      .input('at', sql.DateTime, new Date())
      .query("UPDATE IntranetMinorPurchases SET Status = 'Aprobado', ApprovedBy = @by, ApprovedAt = @at WHERE Id = @id");
    const updated = await pool.request().input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetMinorPurchases WHERE Id = @id');
    res.json(mapMinorPurchase(updated.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/minor-purchases/:id/reject
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .input('by', sql.VarChar, req.body.by)
      .query("UPDATE IntranetMinorPurchases SET Status = 'Rechazado', ApprovedBy = @by WHERE Id = @id");
    const updated = await pool.request().input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM IntranetMinorPurchases WHERE Id = @id');
    res.json(mapMinorPurchase(updated.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;
