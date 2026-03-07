# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
# Note: Since we don't have npm local, we rely on the builder to do it
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Final stage
FROM node:20-slim

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Default command to run the MCP server
ENTRYPOINT ["node", "build/index.js"]
