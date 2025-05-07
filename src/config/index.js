/**
 * Main application configuration
 */
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // App settings
  app: {
    env: process.env.NODE_ENV || 'development',
    backupIntervalDays: parseInt(process.env.BACKUP_INTERVAL_DAYS || '1', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  // Storage configuration
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'spaces', // 'spaces' or 's3'
    endpoint: process.env.STORAGE_ENDPOINT || 'nyc3.digitaloceanspaces.com',
    key: process.env.STORAGE_KEY,
    secret: process.env.STORAGE_SECRET,
    bucket: process.env.STORAGE_BUCKET || 'database-backups',
    path: process.env.STORAGE_PATH || 'backups',
  }
};

export default config; 