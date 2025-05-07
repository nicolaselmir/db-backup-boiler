FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create temp directory for backups
RUN mkdir -p /app/temp
VOLUME /app/temp

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "src/index.js"] 