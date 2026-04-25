const express = require('express');
const path = require('path');
const fs = require('fs');
const { createCrudRoutes } = require('../helpers/crud');
const { readData, writeData, saveFile, UPLOADS_DIR } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'minor-purchases.json';
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'minor-purchases');
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

// Increase JSON limit specifically for receipt uploads (5MB files → ~7MB base64)
const jsonLarge = express.json({ limit: '10mb' });

const router = createCrudRoutes(FILE, 'MP', {
  customRoutes: (r) => {
    r.post('/:id/approve', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      items[idx] = { ...items[idx], status: 'Aprobado', approvedBy: req.body.by, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      writeData(FILE, items);
      res.json(items[idx]);
    });

    r.post('/:id/reject', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      items[idx] = { ...items[idx], status: 'Rechazado', rejectedBy: req.body.by, updatedAt: new Date().toISOString() };
      writeData(FILE, items);
      res.json(items[idx]);
    });

    // Anulación con justificación obligatoria
    r.post('/:id/void', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      const reason = (req.body.reason || '').trim();
      if (!reason) return res.status(400).json({ message: 'Justificación requerida' });
      items[idx] = {
        ...items[idx],
        voided: true,
        voidedReason: reason,
        voidedBy: req.body.by || req.user?.fullName || req.user?.id || 'Sistema',
        voidedAt: new Date().toISOString(),
        status: 'Anulado',
        updatedAt: new Date().toISOString(),
      };
      writeData(FILE, items);
      res.json(items[idx]);
    });

    // Reasignar el ID de un gasto (deja historial). Útil cuando el ID original
    // queda "bloqueado" por un registro anulado y se necesita reordenar la numeración.
    r.post('/:id/reassign-id', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });

      const newId = String(req.body.newId || '').trim().toUpperCase();
      const reason = String(req.body.reason || '').trim();
      const by = req.body.by || req.user?.fullName || req.user?.id || 'Sistema';

      if (!newId) return res.status(400).json({ message: 'Nuevo ID requerido' });
      if (!/^MP-\d{3,}$/.test(newId)) return res.status(400).json({ message: 'Formato esperado: MP-### (ej. MP-002)' });
      if (reason.length < 5) return res.status(400).json({ message: 'Justificación requerida (mín 5 caracteres)' });
      if (newId === items[idx].id) return res.status(400).json({ message: 'El nuevo ID es igual al actual' });

      // Conflicto: el nuevo ID solo puede usarse si NO hay otro registro activo con ese ID.
      // Se permite si el destino existe pero está anulado/eliminado lógicamente (voided=true o status='Anulado').
      const conflict = items.find(i => i.id === newId);
      if (conflict && !(conflict.voided || conflict.status === 'Anulado')) {
        return res.status(409).json({ message: `El ID ${newId} ya está en uso por un gasto activo` });
      }

      const original = items[idx];
      const history = Array.isArray(original.idHistory) ? original.idHistory.slice() : [];
      history.push({
        previousId: original.id,
        newId,
        changedBy: by,
        changedAt: new Date().toISOString(),
        reason,
      });

      items[idx] = {
        ...original,
        id: newId,
        idHistory: history,
        updatedAt: new Date().toISOString(),
      };
      writeData(FILE, items);
      res.json(items[idx]);
    });

    // Subida de comprobante (base64 data URL)
    r.post('/:id/receipt', auth, jsonLarge, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });

      const { dataUrl, fileName } = req.body || {};
      if (!dataUrl || !fileName) return res.status(400).json({ message: 'dataUrl y fileName requeridos' });

      // Validar tipo
      const allowed = /\.(pdf|jpg|jpeg|png)$/i;
      if (!allowed.test(fileName)) return res.status(400).json({ message: 'Solo PDF/JPG/PNG' });

      // Validar tamaño (~5MB)
      const base64 = (dataUrl.split('base64,')[1] || '');
      const sizeBytes = Math.floor(base64.length * 0.75);
      if (sizeBytes > 5 * 1024 * 1024) return res.status(400).json({ message: 'Archivo > 5MB' });

      const safeName = `${req.params.id}_${Date.now()}_${fileName.replace(/[^\w.\-]/g, '_')}`;
      saveFile('minor-purchases', safeName, dataUrl);

      const receiptUrl = `/uploads/minor-purchases/${safeName}`;
      items[idx] = { ...items[idx], receiptUrl, receiptName: fileName, updatedAt: new Date().toISOString() };
      writeData(FILE, items);
      res.json(items[idx]);
    });
  }
});

module.exports = router;
