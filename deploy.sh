#!/bin/bash

# Exit script if any command fails
set -e

echo "===== Database Backup Service Deployment ====="

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "Creating .env file from example.env..."
  cp example.env .env
  echo ".env file created. Please edit it with your configuration."
  echo "Run this script again after configuring your environment variables."
  exit 0
fi

# Check if logs directory exists
if [ ! -d "logs" ]; then
  echo "Creating logs directory..."
  mkdir -p logs
fi

# Check if temp directory exists
if [ ! -d "temp" ]; then
  echo "Creating temp directory..."
  mkdir -p temp
fi

# Build and start the Docker container
echo "Building and starting Docker container..."
docker compose up -d --build

echo "===== Deployment Complete ====="
echo "The database backup service is now running in the background."
echo "To view logs, run: docker compose logs -f db-backup"
echo "To stop the service, run: docker compose down" 