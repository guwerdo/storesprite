# Multi-stage Dockerfile for StoreSprite Downloader Service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies for TypeScript build)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build TypeScript to dist/
COPY src ./src
RUN npm run build

# Prune devDependencies so node_modules contains production-only dependencies
RUN npm prune --omit=dev

# Production stage
FROM node:20-alpine

# Install Python & csvkit for ultra-low memory CSV streaming conversion
RUN apk add --no-cache python3 py3-pip bash tzdata openssh-client openssl \
    && pip install --break-system-packages csvkit

WORKDIR /app

# Set timezone
ENV TZ=Europe/Budapest
RUN cp /usr/share/zoneinfo/Europe/Budapest /etc/localtime \
    && echo "Europe/Budapest" > /etc/timezone

# Copy production node_modules and package.json directly from builder stage (fast, zero-reinstall)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Create temp output directory
RUN mkdir -p /app/temp

ENV NODE_ENV=production
ENV OUTPUT_DIR=/app/temp

VOLUME ["/app/temp"]

CMD ["node", "dist/index.js"]
