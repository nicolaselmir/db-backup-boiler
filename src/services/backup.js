import fs from 'fs';
import logger from '../utils/logger.js';
import storageService from './storage.js';
import postgresBackupService from './databases/postgres.js';
import mongoBackupService from './databases/mongodb.js';
import mysqlBackupService from './databases/mysql.js';
import { getDatabases } from '../config/databases.js';
import config from '../config/index.js';

class BackupService {
    constructor() {
        this.databaseServices = {
            postgres: postgresBackupService,
            postgresql: postgresBackupService,
            mongodb: mongoBackupService,
            mysql: mysqlBackupService,
        };
        
        // Check if cloud storage is configured using config instead of process.env directly
        this.useCloudStorage = !!(config.storage.key && config.storage.secret);
        if (!this.useCloudStorage) {
            logger.warn('Cloud storage credentials not provided. Backups will be stored locally only.');
        }
    }

    getServiceForType(type) {
        const service = this.databaseServices[type];

        if (!service) {
            throw new Error(`Unsupported database type: ${type}`);
        }

        return service;
    }

    async backupDatabase(dbConfig) {
        const { type, name } = dbConfig;
        logger.info(`Starting backup for database: ${name}`, { type });

        try {
            const service = this.getServiceForType(type);

            // Create backup
            const backupPath = await service.createBackup(dbConfig);
            logger.info(`Backup created at: ${backupPath}`, { database: name });

            let url = null;
            
            // Upload to cloud storage if configured
            if (this.useCloudStorage) {
                try {
                    url = await storageService.uploadFile(backupPath, name);
                    logger.info(`Backup uploaded to: ${url}`, { database: name });
                    
                    // Delete local file if uploaded successfully
                    fs.unlinkSync(backupPath);
                    logger.debug(`Deleted local backup file: ${backupPath}`, { database: name });
                } catch (uploadError) {
                    logger.error(`Failed to upload backup to cloud storage: ${uploadError.message}`, {
                        database: name,
                        error: uploadError.message
                    });
                    // Don't throw here, we still have the local backup
                }
            } else {
                logger.info(`Backup stored locally at: ${backupPath}`, { database: name });
            }

            return {
                success: true,
                database: { name, type },
                backupPath: url || backupPath,
                isLocal: !url,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            logger.error(`Backup failed for database: ${name}`, {
                error: error.message,
                stack: error.stack,
            });

            return {
                success: false,
                database: { name, type },
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    async backupAll() {
        logger.info('Starting backup process for all databases');

        const databases = getDatabases();
        const results = [];

        for (const dbConfig of databases) {
            const result = await this.backupDatabase(dbConfig);
            results.push(result);
        }

        const successCount = results.filter(r => r.success).length;
        logger.info(`Backup process completed. Success: ${successCount}/${databases.length}`);

        return results;
    }
}

export default new BackupService();