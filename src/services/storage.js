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
    let endpoint = this.config.endpoint;
    
    // Check if endpoint already contains https:// and remove it if needed
    endpoint = endpoint.replace(/^https?:\/\//, '');
    
    // Fix endpoint format for DigitalOcean Spaces
    // Expected format: <region>.digitaloceanspaces.com
    let region = 'fra1'; // Default region
    
    // Check if the endpoint follows the format <bucketname>.<region>.digitaloceanspaces.com
    if (endpoint.includes('.digitaloceanspaces.com')) {
      const parts = endpoint.split('.');
      if (parts.length >= 3) {
        region = parts[1];
        endpoint = `${parts[1]}.digitaloceanspaces.com`;
        logger.info(`Reformatted endpoint from ${this.config.endpoint} to ${endpoint}`);
      }
    }
    
    logger.info(`Initializing storage client with endpoint: ${endpoint}, region: ${region}`);
    
    return new S3Client({
      endpoint: `https://${endpoint}`,
      region: region,
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
      const bucket = this.config.bucket;
      
      logger.info(`File uploaded successfully to bucket: ${bucket}`);
      
      // Proper DigitalOcean Spaces URL format
      let endpoint = this.config.endpoint.replace(/^https?:\/\//, '');
      let region = 'fra1';
      
      // Extract region from endpoint
      if (endpoint.includes('.digitaloceanspaces.com')) {
        const parts = endpoint.split('.');
        if (parts.length >= 3) {
          region = parts[1];
        }
      }
      
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