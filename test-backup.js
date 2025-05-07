import dotenv from 'dotenv';
import BackupService from './src/services/backup.js';
import config from './src/config/index.js';

// Load environment variables
dotenv.config();

console.log('Environment variables:');
console.log('STORAGE_KEY:', process.env.STORAGE_KEY ? 'Present' : 'Not present');
console.log('STORAGE_SECRET:', process.env.STORAGE_SECRET ? 'Present' : 'Not present');

console.log('\nConfig from config/index.js:');
console.log('config.storage.key:', config.storage.key ? 'Present' : 'Not present');
console.log('config.storage.secret:', config.storage.secret ? 'Present' : 'Not present');
console.log('config.storage.endpoint:', config.storage.endpoint);
console.log('config.storage.bucket:', config.storage.bucket);

console.log('\nBackupService:');
console.log('BackupService.useCloudStorage:', BackupService.useCloudStorage); 