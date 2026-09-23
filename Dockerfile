# Dockerfile for Clio (Vite + React frontend, Express + SQLite backend)

# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=development

COPY package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html ./
COPY 2512.02667v1_Graph_VQ-Transformer__GVT___Fast_and_Accurate_Molecular_Gene.pdf ./
COPY public ./public
COPY src ./src

COPY dist ./dist

# ---------- Production stage ----------
FROM node:20-alpine
WORKDIR /app

# Install server dependencies (better-sqlite3 needs build tools on alpine)
RUN apk add --no-cache python3 make g++

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY server/*.js ./server/

ENV CLIO_DATA_DIR=/data
ENV CLIO_DIST_DIR=/app/dist
ENV PORT=4191

EXPOSE 4191

CMD ["node", "server/index.js"]
