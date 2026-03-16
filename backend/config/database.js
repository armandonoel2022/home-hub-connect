/**
 * Database abstraction layer.
 * Now uses file-based storage (JSON files on disk).
 * SQL Server connection is optional and can be enabled later.
 */

const fileStorage = require('./fileStorage');

// Export file storage as the primary data layer
module.exports = {
  readData: fileStorage.readData,
  writeData: fileStorage.writeData,
  generateId: fileStorage.generateId,
  saveFile: fileStorage.saveFile,
  getDepartmentUploadPath: fileStorage.getDepartmentUploadPath,
  DATA_DIR: fileStorage.DATA_DIR,
  UPLOADS_DIR: fileStorage.UPLOADS_DIR,
  DEPARTMENT_FOLDERS: fileStorage.DEPARTMENT_FOLDERS,
};
