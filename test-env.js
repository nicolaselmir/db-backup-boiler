import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('STORAGE_PROVIDER:', process.env.STORAGE_PROVIDER);
console.log('STORAGE_ENDPOINT:', process.env.STORAGE_ENDPOINT);
console.log('STORAGE_KEY:', process.env.STORAGE_KEY ? 'Present' : 'Not present');
console.log('STORAGE_SECRET:', process.env.STORAGE_SECRET ? 'Present' : 'Not present');
console.log('STORAGE_BUCKET:', process.env.STORAGE_BUCKET);
console.log('STORAGE_PATH:', process.env.STORAGE_PATH);

// Check if STORAGE_ENDPOINT includes https://
if (process.env.STORAGE_ENDPOINT) {
  console.log('STORAGE_ENDPOINT includes https://:', process.env.STORAGE_ENDPOINT.includes('https://'));
} 