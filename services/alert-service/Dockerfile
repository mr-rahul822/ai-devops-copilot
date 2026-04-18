FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

EXPOSE 3003

CMD ["node", "src/index.js"]
