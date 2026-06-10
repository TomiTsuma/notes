# Dockerfile for the productivity suite (Vite + React)

# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (only lockfile & package.json are needed for npm ci)
COPY package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html ./
COPY public ./public
COPY src ./src

# Install exact dependencies and build the production bundle
RUN npm ci && npm run build

# ---------- Production stage ----------
FROM node:20-alpine
WORKDIR /app

# Copy the built static files from the builder stage
COPY --from=builder /app/dist ./dist

# Install a simple HTTP server to serve the static files
RUN npm install -g serve

EXPOSE 4191
# Serve the static files on port 8191, binding to 0.0.0.0
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:4191"]
