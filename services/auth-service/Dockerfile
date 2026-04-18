FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (for better Docker layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Expose the auth service port
EXPOSE 3001

# Start the service
CMD ["node", "src/index.js"]