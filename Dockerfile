# Dockerfile for the productivity suite (Vite + React)

# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (only lockfile & package.json are needed for npm ci)
COPY package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

# Install exact dependencies and build the production bundle
RUN npm ci && npm run build

# ---------- Production stage ----------
FROM nginx:stable-alpine
# Copy the built static files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Optional custom nginx config (uncomment if you have one)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
# Run nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
