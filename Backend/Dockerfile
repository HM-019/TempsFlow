# ============================================================
#  TempsFlow — Backend Dockerfile
#  Node.js 20 + Express API
# ============================================================

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]