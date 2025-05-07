import path from 'path';
import fs from 'fs';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class StorageService {
  constructor() {
    this.config = config.storage;
    this.client = this.initializeClient();
  }

  initializeClient() {
    const endpoint = this.config.endpoint;
    
    // Check if endpoint already contains https:// and remove it if needed
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '');
    
    logger.info(`Initializing storage client with endpoint: ${cleanEndpoint}`);
    
    return new S3Client({
      endpoint: `https://${cleanEndpoint}`,
      region: cleanEndpoint.split('.')[1] || 'us-east-1', // Extract region from endpoint (e.g. "fra1" from "guideit-storage.fra1.digitaloceanspaces.com")
      credentials: {
        accessKeyId: this.config.key,
        secretAccessKey: this.config.secret,
      },
      forcePathStyle: this.config.provider === 'spaces',
    });
  }

  async uploadFile(filePath, dbName) {
    const fileName = path.basename(filePath);
    const datePrefix = new Date().toISOString().split('T')[0];
    
    // Simplified path structure - remove nested folders to make it more visible in the Spaces browser
    // Format: path/dbName-YYYY-MM-DD-filename
    const key = `${this.config.path}/${dbName}-${datePrefix}-${fileName}`;
    
    logger.info(`Generated storage key: ${key}`);
    
    const fileContent = fs.readFileSync(filePath);
    
    const params = {
      Bucket: this.config.bucket,
      Key: key,
      Body: fileContent,
      ContentType: 'application/octet-stream',
    };
    
    try {
      logger.info(`Uploading file to ${this.config.provider} storage: ${key}`);
      await this.client.send(new PutObjectCommand(params));
      
      const protocol = 'https';
      const endpoint = this.config.endpoint.replace(/^https?:\/\//, '');
      const bucket = this.config.bucket;
      
      logger.info(`File uploaded successfully to bucket: ${bucket}`);
      
      // Extract region from endpoint (e.g., "fra1" from "guideit-storage.fra1.digitaloceanspaces.com")
      const parts = endpoint.split('.');
      const region = parts[1] || 'us-east-1';
      
      // For Digital Ocean Spaces, construct the proper URL
      // Format: https://<bucket>.<region>.digitaloceanspaces.com/<key>
      return `${protocol}://${bucket}.${region}.digitaloceanspaces.com/${key}`;
    } catch (error) {
      logger.error(`Failed to upload file to cloud storage: ${error.message}`, { error });
      throw new Error(`Failed to upload file to cloud storage: ${error.message}`);
    }
  }

  async deleteFile(key) {
    const params = {
      Bucket: this.config.bucket,
      Key: key,
    };
    
    try {
      await this.client.send(new DeleteObjectCommand(params));
    } catch (error) {
      throw new Error(`Failed to delete file from cloud storage: ${error.message}`);
    }
  }
}

export default new StorageService();