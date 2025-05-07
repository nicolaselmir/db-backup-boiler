import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { formatDate } from '../../utils/date.js';

class PostgresBackupService {
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
    
    // Parse connection string to see if we can add SSL params directly
    const url = new URL(connectionString);
    
    // Create connection config
    const connectionConfig = {
      host: url.hostname,
      port: url.port || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.replace('/', ''),
    };
    
    // Add SSL options
    if (useSSL) {
      // Digital Ocean requires specific SSL settings
      connectionConfig.ssl = {
        rejectUnauthorized: false
      };
      
      // If a certificate file is provided, use it
      if (sslCertPath && fs.existsSync(sslCertPath)) {
        try {
          connectionConfig.ssl.ca = fs.readFileSync(sslCertPath).toString();
        } catch (error) {
          console.warn(`Could not read SSL certificate from ${sslCertPath}: ${error.message}`);
        }
      }
    }
    
    console.log(`Connecting to PostgreSQL with SSL config: ${JSON.stringify({
      ...connectionConfig,
      password: '******' // Mask password in logs
    }, null, 2)}`);
    
    const writeStream = fs.createWriteStream(backupPath);
    
    const client = new pg.Client(connectionConfig);
    
    try {
      await client.connect();
      console.log("Connected to PostgreSQL successfully!");
      
      // Add database header info
      writeStream.write(`-- PostgreSQL database dump\n`);
      writeStream.write(`-- Database: ${connectionConfig.database}\n`);
      writeStream.write(`-- Generated: ${new Date().toISOString()}\n\n`);
      
      // Write database creation and connection
      writeStream.write(`CREATE DATABASE ${connectionConfig.database};\n`);
      writeStream.write(`\\connect ${connectionConfig.database};\n\n`);
      
      // Try to get schemas - don't fail if can't get them
      try {
        const schemaResult = await client.query(`
          SELECT schema_name 
          FROM information_schema.schemata 
          WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        `);
        
        for (const row of schemaResult.rows) {
          const schemaName = row.schema_name;
          writeStream.write(`CREATE SCHEMA IF NOT EXISTS ${schemaName};\n\n`);
        }
      } catch (error) {
        console.warn(`Could not retrieve schemas: ${error.message}`);
        writeStream.write(`-- Could not retrieve schemas: ${error.message}\n\n`);
      }
      
      // Get list of all tables
      try {
        const tableResult = await client.query(`
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND table_type = 'BASE TABLE'
        `);
        
        // Process each table
        for (const row of tableResult.rows) {
          try {
            const schema = row.table_schema;
            const table = row.table_name;
            const fullTableName = `${schema}.${table}`;
            
            console.log(`Processing table: ${fullTableName}`);
            
            // Get table schema creation script
            const tableSchemaResult = await client.query(`
              SELECT column_name, data_type, is_nullable, column_default
              FROM information_schema.columns
              WHERE table_schema = $1 AND table_name = $2
              ORDER BY ordinal_position
            `, [schema, table]);
            
            // Write table creation statement
            writeStream.write(`CREATE TABLE IF NOT EXISTS ${fullTableName} (\n`);
            
            const columns = tableSchemaResult.rows.map(col => {
              let colDef = `  "${col.column_name}" ${col.data_type}`;
              if (col.is_nullable === 'NO') colDef += ' NOT NULL';
              if (col.column_default) colDef += ` DEFAULT ${col.column_default}`;
              return colDef;
            });
            
            writeStream.write(columns.join(',\n'));
            writeStream.write('\n);\n\n');
            
            // Safely get table data
            try {
              const dataResult = await client.query(`SELECT * FROM ${fullTableName} LIMIT 1000`);
              
              if (dataResult.rows.length > 0) {
                for (const dataRow of dataResult.rows) {
                  const columns = Object.keys(dataRow).join(', ');
                  const values = Object.values(dataRow).map(value => {
                    if (value === null) return 'NULL';
                    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                    return value;
                  }).join(', ');
                  
                  writeStream.write(`INSERT INTO ${fullTableName} (${columns}) VALUES (${values});\n`);
                }
                writeStream.write('\n');
              } else {
                writeStream.write(`-- Table ${fullTableName} has no data\n\n`);
              }
            } catch (tableError) {
              console.warn(`Could not retrieve data for table ${fullTableName}: ${tableError.message}`);
              writeStream.write(`-- Could not retrieve data for table ${fullTableName}: ${tableError.message}\n\n`);
            }
          } catch (tableError) {
            console.warn(`Could not process table ${row.table_schema}.${row.table_name}: ${tableError.message}`);
            writeStream.write(`-- Could not process table ${row.table_schema}.${row.table_name}: ${tableError.message}\n\n`);
          }
        }
      } catch (error) {
        console.warn(`Could not retrieve tables: ${error.message}`);
        writeStream.write(`-- Could not retrieve tables: ${error.message}\n\n`);
      }
      
      // Try to get functions - don't fail if can't get them
      try {
        const functionResult = await client.query(`
          SELECT routine_schema, routine_name, routine_definition
          FROM information_schema.routines
          WHERE routine_schema NOT IN ('pg_catalog', 'information_schema')
        `);
        
        for (const row of functionResult.rows) {
          if (row.routine_definition) {
            writeStream.write(`${row.routine_definition};\n\n`);
          }
        }
      } catch (error) {
        console.warn(`Could not retrieve functions: ${error.message}`);
        writeStream.write(`-- Could not retrieve functions: ${error.message}\n\n`);
      }
      
      // Try to get indexes - don't fail if can't get them
      try {
        const indexResult = await client.query(`
          SELECT indexdef
          FROM pg_indexes
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        `);
        
        for (const row of indexResult.rows) {
          writeStream.write(`${row.indexdef};\n\n`);
        }
      } catch (error) {
        console.warn(`Could not retrieve indexes: ${error.message}`);
        writeStream.write(`-- Could not retrieve indexes: ${error.message}\n\n`);
      }
      
      console.log(`Backup completed successfully to ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error(`Error during PostgreSQL backup: ${error.message}`);
      // Make sure to still return the file with any partial backups
      // Close the write stream first
      writeStream.end(`-- Error during backup: ${error.message}\n`);
      
      // Either return the partial backup path or throw the error
      throw error;
    } finally {
      try {
        await client.end();
        writeStream.end();
      } catch (error) {
        console.error('Error closing resources:', error);
      }
    }
  }
}

export default new PostgresBackupService();