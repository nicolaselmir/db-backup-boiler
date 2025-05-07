import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { formatDate } from '../../utils/date.js';

class MongoDBBackupService {
  async createBackup(dbConfig) {
    const { connectionString, name, useSSL, sslCertPath } = dbConfig;
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const backupDir = path.join(__dirname, '../../../temp');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = formatDate(new Date());
    const backupFilename = `${name}_${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);
    const archivePath = `${backupPath}.gz`;
    
    const options = {};
    
    if (useSSL) {
      options.tls = true;
      options.tlsAllowInvalidCertificates = true;
      
      if (sslCertPath && fs.existsSync(sslCertPath)) {
        try {
          options.tlsCAFile = sslCertPath;
        } catch (error) {
          console.warn(`Could not use SSL certificate from ${sslCertPath}: ${error.message}`);
        }
      }
    }
    
    let client;
    const writeStream = fs.createWriteStream(backupPath);
    
    try {
      client = new MongoClient(connectionString, options);
      await client.connect();
      
      let dbName;
      const url = new URL(connectionString);
      if (url.pathname && url.pathname.length > 1) {
        dbName = url.pathname.substring(1);
      } else {
        const adminDb = client.db('admin');
        const dbs = await adminDb.admin().listDatabases();
        const databases = dbs.databases.filter(db => 
          !['admin', 'local', 'config'].includes(db.name)
        );
        
        if (databases.length > 0) {
          dbName = databases[0].name;
        } else {
          throw new Error('No database found to backup');
        }
      }
      
      const db = client.db(dbName);
      
      const collections = await db.listCollections().toArray();
      
      writeStream.write(JSON.stringify({
        database: dbName,
        createdAt: new Date().toISOString(),
        collections: collections.length
      }, null, 2) + '\n');
      
      for (const collection of collections) {
        const collectionName = collection.name;
        const coll = db.collection(collectionName);
        
        writeStream.write(JSON.stringify({
          collection: collectionName,
          type: 'header'
        }, null, 2) + '\n');
        
        const batchSize = 100;
        const cursor = coll.find({});
        let docs = await cursor.limit(batchSize).toArray();
        
        while (docs.length > 0) {
          for (const doc of docs) {
            writeStream.write(JSON.stringify({
              collection: collectionName,
              type: 'document',
              data: doc
            }, null, 2) + '\n');
          }
          
          const lastId = docs[docs.length - 1]._id;
          docs = await coll.find({ _id: { $gt: lastId } }).limit(batchSize).toArray();
        }
        
        writeStream.write(JSON.stringify({
          collection: collectionName,
          type: 'footer'
        }, null, 2) + '\n');
      }
      
      writeStream.end();
      
      await new Promise((resolve) => {
        writeStream.on('finish', resolve);
      });
      
      const source = fs.createReadStream(backupPath);
      const destination = fs.createWriteStream(archivePath);
      const gzip = createGzip();
      
      await pipeline(source, gzip, destination);
      
      fs.unlinkSync(backupPath);
      
      return archivePath;
    } catch (error) {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      
      throw error;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
  
  async restoreBackup(backupPath, connectionString, options = {}) {
    const client = new MongoClient(connectionString, options);
    const collections = {};
    
    try {
      await client.connect();
      
      let jsonFilePath = backupPath;
      if (backupPath.endsWith('.gz')) {
        const extractedPath = backupPath.slice(0, -3);
        const source = fs.createReadStream(backupPath);
        const destination = fs.createWriteStream(extractedPath);
        const gunzip = createGunzip();
        
        await pipeline(source, gunzip, destination);
        jsonFilePath = extractedPath;
      }
      
      const content = fs.readFileSync(jsonFilePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const metadata = JSON.parse(lines[0]);
      const dbName = metadata.database;
      const db = client.db(dbName);
      
      for (let i = 1; i < lines.length; i++) {
        const entry = JSON.parse(lines[i]);
        
        if (entry.type === 'header') {
          const collectionName = entry.collection;
          collections[collectionName] = db.collection(collectionName);
          
          try {
            await collections[collectionName].drop();
          } catch (e) {
          }
        } else if (entry.type === 'document') {
          const collectionName = entry.collection;
          await collections[collectionName].insertOne(entry.data);
        }
      }
      
      if (jsonFilePath !== backupPath) {
        fs.unlinkSync(jsonFilePath);
      }
      
      return true;
    } finally {
      await client.close();
    }
  }
}

export default new MongoDBBackupService();