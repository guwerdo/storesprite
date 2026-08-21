# Multi-stage Dockerfile for StoreSprite Downloader Service (Production)
FROM node:24-slim AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies for TypeScript build)
COPY downloader/package*.json downloader/tsconfig.json ./
RUN npm ci

# Copy source code and build TypeScript to dist/
COPY downloader/src ./src
RUN npm run build

# Prune devDependencies so node_modules contains production-only dependencies
RUN npm prune --omit=dev

# Production stage
FROM node:24-slim

# Install Python & csvkit for ultra-low memory CSV streaming conversion, bash, tzdata, openssh-client, openssl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip csvkit bash tzdata openssh-client openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set timezone
ENV TZ=Europe/Budapest
RUN ln -fs /usr/share/zoneinfo/Europe/Budapest /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata

# Copy production node_modules and package.json directly from builder stage
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
