# Docker Setup for Database Backup Application

This document provides instructions for running the database backup application using Docker and Docker Compose.

## Prerequisites

- Docker
- Docker Compose
- Valid database credentials
- Valid DigitalOcean Spaces (or other S3 compatible) credentials

## Setup Instructions

### 1. Create the Environment File

Copy the example environment file to create your `.env` file:

```bash
cp example.env .env
```

Edit the `.env` file to add your specific configuration:
- Database connection strings
- DigitalOcean Spaces credentials
- Backup interval settings

### 2. SSL Certificate (if needed)

If your database requires SSL connectivity, make sure to place the certificate file in the project root directory and update the path in the `.env` file:

```
DB_PG_SSL_CERT_PATH=./ca-certificate.crt
```

### 3. Build and Start the Container

```bash
docker-compose up -d
```

This will:
- Build the Docker image
- Start the container in detached mode
- Mount the necessary volumes for backups and logs
- Load your environment configuration

### 4. Check Logs

You can view the logs to verify the application is running correctly:

```bash
docker-compose logs -f db-backup
```

### 5. Stopping the Service

To stop the backup service:

```bash
docker-compose down
```

## Volume Mounts

The docker-compose.yml file configures the following volume mounts:

- `./temp:/app/temp` - Stores temporary backup files
- `./logs:/app/logs` - Stores application logs
- `./.env:/app/.env` - Loads your environment configuration

## Environment Variables

See the `example.env` file for all available configuration options.

## Maintenance

### Rebuilding the Container

If you make changes to the application code, rebuild the container:

```bash
docker-compose build
docker-compose up -d
```

### Backup Files

Backup files are stored in the `./temp` directory on your host machine and can be accessed directly. 