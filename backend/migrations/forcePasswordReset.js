/**
 * One-time migration: forces all existing users to change their password
 * on next login. Runs once at startup; tracked in data/migrations.json.
 *
 * To re-trigger globally, remove the key "force-password-reset-v1" from
 * data/migrations.json and restart the backend.
 */
const path = require('path');
const fs = require('fs');
const { readData, writeData, DATA_DIR } = require('../config/database');

const MIGRATIONS_FILE = 'migrations.json';
const USERS_FILE = 'users.json';
const KEY = 'force-password-reset-v1';

function run() {
  try {
    const migrations = readData(MIGRATIONS_FILE) || {};
    // readData returns [] when file missing; normalize to object
    const state = Array.isArray(migrations) ? {} : migrations;

    if (state[KEY]) {
      return; // already applied
    }

    const users = readData(USERS_FILE);
    if (!Array.isArray(users) || users.length === 0) return;

    let count = 0;
    users.forEach(u => {
      u.mustChangePassword = true;
      count++;
    });
    writeData(USERS_FILE, users);

    state[KEY] = {
      appliedAt: new Date().toISOString(),
      affectedUsers: count,
    };
    // write directly as object (readData/writeData handle JSON either way)
    const fullPath = path.join(DATA_DIR, MIGRATIONS_FILE);
    fs.writeFileSync(fullPath, JSON.stringify(state, null, 2), 'utf8');

    console.log(`🔐 Migración aplicada: ${count} usuarios deben cambiar su contraseña en el próximo inicio de sesión.`);
  } catch (err) {
    console.error('⚠️  Error aplicando migración forcePasswordReset:', err.message);
  }
}

module.exports = { run };
