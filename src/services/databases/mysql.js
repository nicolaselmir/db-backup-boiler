import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { formatDate } from '../../utils/date.js';

class MySQLBackupService {
  async createBackup(dbConfig) {
    const { connectionString, name, useSSL, sslCertPath } = dbConfig;
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const backupDir = path.join(__dirname, '../../../temp');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = formatDate(new Date());
    const backupFilename = `${name}_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFilename);
    
    const url = new URL(connectionString);
    const host = url.hostname;
    const port = url.port || '3306';
    const user = url.username;
    const password = url.password;
    const database = url.pathname.replace('/', '');
    
    const sslOptions = {};
    if (useSSL) {
      sslOptions.ssl = {
        rejectUnauthorized: false
      };
      if (sslCertPath && fs.existsSync(sslCertPath)) {
        try {
          sslOptions.ssl.ca = fs.readFileSync(sslCertPath).toString();
        } catch (error) {
          console.warn(`Could not read SSL certificate from ${sslCertPath}: ${error.message}`);
        }
      }
    }
    
    const writeStream = fs.createWriteStream(backupPath);
    
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      ...sslOptions,
    });
    
    try {
      writeStream.write(`-- Database backup for: ${database}\n`);
      writeStream.write(`-- Generated on: ${new Date().toISOString()}\n\n`);
      writeStream.write(`CREATE DATABASE IF NOT EXISTS \`${database}\`;\n`);
      writeStream.write(`USE \`${database}\`;\n\n`);
      
      const [tables] = await connection.query('SHOW TABLES');
      
      for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0];
        
        const [createTableResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createTableSql = createTableResult[0]['Create Table'];
        
        writeStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
        writeStream.write(`${createTableSql};\n\n`);
        
        const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
        
        if (rows.length > 0) {
          const batchSize = 100;
          
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            
            if (batch.length > 0) {
              writeStream.write(`INSERT INTO \`${tableName}\` VALUES\n`);
              
              const rowValues = batch.map(row => {
                const values = Object.values(row).map(value => {
                  if (value === null) return 'NULL';
                  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
                  if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;
                  return value;
                });
                
                return `(${values.join(', ')})`;
              });
              
              writeStream.write(rowValues.join(',\n') + ';\n\n');
            }
          }
        }
      }
      
      const [procedures] = await connection.query(
        `SELECT routine_name, routine_definition 
         FROM information_schema.routines 
         WHERE routine_schema = ? AND routine_type = 'PROCEDURE'`, 
        [database]
      );
      
      if (procedures.length > 0) {
        writeStream.write('-- Stored Procedures\n');
        writeStream.write('DELIMITER //\n\n');
        
        for (const proc of procedures) {
          const procName = proc.routine_name;
          writeStream.write(`DROP PROCEDURE IF EXISTS \`${procName}\`//\n`);
          writeStream.write(`CREATE PROCEDURE \`${procName}\` ${proc.routine_definition}//\n\n`);
        }
        
        writeStream.write('DELIMITER ;\n\n');
      }
      
      const [functions] = await connection.query(
        `SELECT routine_name, routine_definition 
         FROM information_schema.routines 
         WHERE routine_schema = ? AND routine_type = 'FUNCTION'`, 
        [database]
      );
      
      if (functions.length > 0) {
        writeStream.write('-- Functions\n');
        writeStream.write('DELIMITER //\n\n');
        
        for (const func of functions) {
          const funcName = func.routine_name;
          writeStream.write(`DROP FUNCTION IF EXISTS \`${funcName}\`//\n`);
          writeStream.write(`CREATE FUNCTION \`${funcName}\` ${func.routine_definition}//\n\n`);
        }
        
        writeStream.write('DELIMITER ;\n\n');
      }
      
      const [triggers] = await connection.query(
        `SELECT trigger_name, action_statement, event_manipulation, event_object_table 
         FROM information_schema.triggers 
         WHERE trigger_schema = ?`, 
        [database]
      );
      
      if (triggers.length > 0) {
        writeStream.write('-- Triggers\n');
        writeStream.write('DELIMITER //\n\n');
        
        for (const trigger of triggers) {
          const triggerName = trigger.trigger_name;
          writeStream.write(`DROP TRIGGER IF EXISTS \`${triggerName}\`//\n`);
          writeStream.write(`CREATE TRIGGER \`${triggerName}\` ${trigger.event_manipulation} ON \`${trigger.event_object_table}\` FOR EACH ROW ${trigger.action_statement}//\n\n`);
        }
        
        writeStream.write('DELIMITER ;\n\n');
      }
      
      return backupPath;
    } finally {
      try {
        await connection.end();
        writeStream.end();
      } catch (error) {
        console.error('Error closing resources:', error);
      }
    }
  }
}

export default new MySQLBackupService();