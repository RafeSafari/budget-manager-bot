FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

# Expose port (not needed for bot, but Railway expects it)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
