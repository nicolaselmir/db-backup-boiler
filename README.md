# DB Backup Boiler

A scalable Node.js application for automated database backups with cloud storage support.

## Features

- Supports multiple database types (PostgreSQL, MySQL, MongoDB, etc.)
- Push backups to Digital Ocean Spaces or Amazon S3
- Configurable backup schedule
- Support for SSL certificates and custom authentication
- Extensible architecture for adding more databases and storage providers

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (see `.env.example`)

3. Run the application:
```bash
npm start
```

## Configuration

Create a `.env` file with the following variables:

```
# App Configuration
NODE_ENV=development
BACKUP_INTERVAL_DAYS=3

# Storage Configuration
STORAGE_PROVIDER=spaces # or s3
STORAGE_ENDPOINT=nyc3.digitaloceanspaces.com
STORAGE_KEY=your_access_key
STORAGE_SECRET=your_secret_key
STORAGE_BUCKET=your_backup_bucket
STORAGE_PATH=database-backups

# Database Configurations (can add multiple)
# See config/databases.js for structure
```

## Adding a New Database Source

Add your database configuration to `config/databases.js`. 