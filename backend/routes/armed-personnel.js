const path = require('path');
const fs = require('fs');
const { readData, writeData } = require('../config/database');
const { createCrudRoutes } = require('../helpers/crud');

// Auto-seed armed personnel data on first read if file is empty.
// This way, the server's JSON gets populated with initial data and
// any subsequent edits/transfers/assignments persist.
function ensureSeed() {
  try {
    const existing = readData('armed-personnel.json');
    if (Array.isArray(existing) && existing.length > 0) return;
    const seedPath = path.join(__dirname, '..', 'helpers', 'armedPersonnelSeed.json');
    if (!fs.existsSync(seedPath)) return;
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const now = new Date().toISOString();
    const stamped = seed.map(p => ({ ...p, createdAt: now, updatedAt: now }));
    writeData('armed-personnel.json', stamped);
    console.log(`✅ armed-personnel.json sembrado con ${stamped.length} registros iniciales`);
  } catch (err) {
    console.error('Error al sembrar armed-personnel:', err.message);
  }
}

ensureSeed();

module.exports = createCrudRoutes('armed-personnel.json', 'AP');
