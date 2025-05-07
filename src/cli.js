#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { getDatabases } from './config/databases.js';
import backupService from './services/backup.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

const program = new Command();
const databases = getDatabases();

program
  .name('db-backup')
  .description('Database backup tool')
  .version('1.0.0');

// Command to list configured databases
program
  .command('list')
  .description('List configured databases')
  .action(() => {
    console.log('\nConfigured databases:');
    databases.forEach((db, index) => {
      console.log(`\n${index + 1}. ${db.name}`);
      console.log(`   Type: ${db.type}`);
      console.log(`   Connection: ${maskConnectionString(db.connectionString)}`);
    });
  });

// Command to run an immediate backup of all databases
program
  .command('backup-all')
  .description('Run an immediate backup of all databases')
  .action(async () => {
    try {
      console.log('\nStarting backup of all databases...');
      const results = await backupService.backupAll();
      
      console.log('\nBackup results:');
      results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.database.name}`);
        console.log(`   Status: ${result.success ? 'Success' : 'Failed'}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        if (result.backupPath) {
          console.log(`   Location: ${result.backupPath}`);
          console.log(`   Type: ${result.isLocal ? 'Local file' : 'Cloud storage'}`);
        }
      });
    } catch (error) {
      console.error('Error during backup:', error);
      process.exit(1);
    }
  });

// Command to backup a specific database
program
  .command('backup')
  .description('Backup a specific database')
  .argument('<database-name>', 'Name of the database to backup')
  .action(async (databaseName) => {
    try {
      const database = databases.find(db => db.name === databaseName);
      
      if (!database) {
        console.error(`Database "${databaseName}" not found in configuration`);
        process.exit(1);
      }
      
      console.log(`\nStarting backup of database "${databaseName}"...`);
      const result = await backupService.backupDatabase(database);
      
      console.log('\nBackup result:');
      console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      if (result.backupPath) {
        console.log(`Location: ${result.backupPath}`);
        console.log(`Type: ${result.isLocal ? 'Local file' : 'Cloud storage'}`);
      }
    } catch (error) {
      console.error('Error during backup:', error);
      process.exit(1);
    }
  });

// Helper function to mask sensitive parts of connection strings
function maskConnectionString(connectionString) {
  const url = new URL(connectionString);
  if (url.password) {
    url.password = '******';
  }
  return url.toString();
}

program.parse(); 