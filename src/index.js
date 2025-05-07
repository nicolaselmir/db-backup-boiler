import dotenv from 'dotenv';
import cron from 'node-cron';
import logger from './utils/logger.js';
import backupService from './services/backup.js';
import config from './config/index.js';
import { getDatabases } from './config/databases.js';

dotenv.config();

const initializeScheduler = () => {
  const intervalDays = config.app.backupIntervalDays;
  
  const databases = getDatabases();
  if (databases.length === 0) {
    logger.warn('No databases configured for backup. Add database configurations to start backups.');
    return;
  }
  
  logger.info(`Scheduling backups every ${intervalDays} days`);
  
  const cronExpression = `0 0 */${intervalDays} * *`;
  
  cron.schedule(cronExpression, async () => {
    logger.info('Running scheduled backup job');
    await backupService.backupAll();
  });
  
  logger.info('Backup scheduler initialized successfully');
};

const runImmediateBackup = async () => {
  logger.info('Running immediate backup');
  const results = await backupService.backupAll();
  return results;
};

const startup = async () => {
  logger.info('Starting DB Backup application');
  
  try {
    initializeScheduler();
    
    await runImmediateBackup();
    
    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to start application', { 
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startup();

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export { runImmediateBackup };