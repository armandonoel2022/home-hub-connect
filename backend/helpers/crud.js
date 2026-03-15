/**
 * Generic CRUD factory for Express routes + SQL Server
 */
const { getPool, sql } = require('../config/database');

function generateId(prefix) {
  return `${prefix}-${Date.now().toString().slice(-8)}`;
}

/**
 * Creates standard CRUD routes for a table.
 * @param {object} opts
 * @param {string} opts.table - SQL table name
 * @param {string} opts.idPrefix - ID prefix (e.g. 'TK', 'EQ')
 * @param {Function} opts.mapper - Row mapper function
 * @param {object} opts.insertFields - { frontendKey: { col: 'SqlColumn', type: sql.VarChar } }
 * @param {object} opts.updateFields - same format, fields allowed for update
 */
function createCrudRouter({ table, idPrefix, mapper, insertFields, updateFields }) {
  const express = require('express');
  const auth = require('../middleware/auth');
  const router = express.Router();

  // GET all
  router.get('/', auth, async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.request().query(`SELECT * FROM ${table} ORDER BY CreatedAt DESC`);
      res.json(result.recordset.map(mapper));
    } catch (err) {
      console.error(`GET ${table} error:`, err);
      res.status(500).json({ message: `Error obteniendo datos de ${table}` });
    }
  });

  // GET by id
  router.get('/:id', auth, async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query(`SELECT * FROM ${table} WHERE Id = @id`);
      if (result.recordset.length === 0) return res.status(404).json({ message: 'No encontrado' });
      res.json(mapper(result.recordset[0]));
    } catch (err) {
      res.status(500).json({ message: 'Error del servidor' });
    }
  });

  // POST create
  router.post('/', auth, async (req, res) => {
    try {
      const pool = getPool();
      const id = req.body.id || generateId(idPrefix);
      const now = new Date();
      const request = pool.request();
      request.input('id', sql.VarChar, id);
      request.input('createdAt', sql.DateTime, now);

      const cols = ['Id', 'CreatedAt'];
      const vals = ['@id', '@createdAt'];

      for (const [key, cfg] of Object.entries(insertFields)) {
        const value = req.body[key];
        const paramName = key.replace(/[^a-zA-Z0-9]/g, '');
        if (value !== undefined) {
          request.input(paramName, cfg.type, cfg.serialize ? cfg.serialize(value) : value);
          cols.push(cfg.col);
          vals.push(`@${paramName}`);
        }
      }

      await request.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')})`);

      // Return the created record
      const created = await pool.request()
        .input('id', sql.VarChar, id)
        .query(`SELECT * FROM ${table} WHERE Id = @id`);
      res.status(201).json(mapper(created.recordset[0]));
    } catch (err) {
      console.error(`POST ${table} error:`, err);
      res.status(500).json({ message: `Error creando en ${table}` });
    }
  });

  // PUT update
  router.put('/:id', auth, async (req, res) => {
    try {
      const pool = getPool();
      const request = pool.request();
      request.input('id', sql.VarChar, req.params.id);

      const sets = ['UpdatedAt = GETDATE()'];
      const fields = updateFields || insertFields;

      for (const [key, cfg] of Object.entries(fields)) {
        if (req.body[key] !== undefined) {
          const paramName = key.replace(/[^a-zA-Z0-9]/g, '');
          request.input(paramName, cfg.type, cfg.serialize ? cfg.serialize(req.body[key]) : req.body[key]);
          sets.push(`${cfg.col} = @${paramName}`);
        }
      }

      await request.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE Id = @id`);

      const updated = await pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query(`SELECT * FROM ${table} WHERE Id = @id`);
      if (updated.recordset.length === 0) return res.status(404).json({ message: 'No encontrado' });
      res.json(mapper(updated.recordset[0]));
    } catch (err) {
      console.error(`PUT ${table} error:`, err);
      res.status(500).json({ message: `Error actualizando ${table}` });
    }
  });

  // DELETE
  router.delete('/:id', auth, async (req, res) => {
    try {
      const pool = getPool();
      await pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query(`DELETE FROM ${table} WHERE Id = @id`);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: `Error eliminando de ${table}` });
    }
  });

  return router;
}

module.exports = { createCrudRouter, generateId };
