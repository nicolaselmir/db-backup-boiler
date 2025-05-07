import dotenv from 'dotenv';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Load environment variables
dotenv.config();

async function listFilesInSpaces() {
  console.log("Checking files in DigitalOcean Spaces...");
  
  // Extract configuration from environment
  const provider = process.env.STORAGE_PROVIDER;
  const endpoint = process.env.STORAGE_ENDPOINT.replace(/^https?:\/\//, '');
  const key = process.env.STORAGE_KEY;
  const secret = process.env.STORAGE_SECRET;
  const bucket = process.env.STORAGE_BUCKET;
  const path = process.env.STORAGE_PATH || 'database-backups';
  
  console.log(`Provider: ${provider}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Key: ${key ? '******' + key.slice(-4) : 'Not provided'}`);
  console.log(`Secret: ${secret ? '******' : 'Not provided'}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Path: ${path}`);
  
  // Create client
  const s3Config = {
    endpoint: `https://${endpoint}`,
    region: endpoint.split('.')[1] || 'us-east-1',
    credentials: {
      accessKeyId: key,
      secretAccessKey: secret,
    },
    forcePathStyle: provider === 'spaces',
  };
  
  console.log('\nS3 Config:', JSON.stringify({
    ...s3Config,
    credentials: {
      accessKeyId: '******',
      secretAccessKey: '******'
    }
  }, null, 2));
  
  const client = new S3Client(s3Config);
  
  // Create command
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: path,
    // Limit to 10 results for testing
    MaxKeys: 10
  });
  
  try {
    // Execute command
    console.log(`\nSending request to list objects in bucket: ${bucket}`);
    const response = await client.send(command);
    
    console.log("\nFiles found in Spaces bucket:");
    
    if (response.Contents && response.Contents.length > 0) {
      response.Contents.forEach((item, index) => {
        console.log(`${index + 1}. ${item.Key} (${formatBytes(item.Size)})`);
      });
    } else {
      console.log("No files found in the specified path.");
    }
  } catch (error) {
    console.error("Error listing files:");
    console.error("  Message:", error.message);
    console.error("  Name:", error.name);
    console.error("  Code:", error.Code);
    if (error.stack) {
      console.error("  Stack:", error.stack);
    }
    
    console.log("\nPlease check if:");
    console.log("1. Your Spaces access key and secret are correct");
    console.log("2. The bucket name exists and is correct");
    console.log("3. Your IAM permissions allow listing objects in this bucket");
    console.log("4. Your endpoint format is correct (should be: <region>.digitaloceanspaces.com)");
  }
}

// Utility function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Run the function
listFilesInSpaces(); 