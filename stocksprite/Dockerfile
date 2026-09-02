# syntax=docker/dockerfile:1
# Combined StoreSprite worker: downloader → processor (build context = repo root)

# ---- Stage 1: build the shared packages (file: deps of the processor) ----
FROM node:24-slim AS packages
WORKDIR /workspace
COPY packages/app-config/package*.json packages/app-config/
COPY packages/unas-json-client/package*.json packages/unas-json-client/
COPY packages/mapping-rules/package*.json packages/mapping-rules/
RUN cd packages/app-config && npm ci && npm run build
RUN cd packages/unas-json-client && npm ci && npm run build
RUN cd packages/mapping-rules && npm ci && npm run build
COPY packages ./packages

# ---- Stage 2: build the downloader ----
FROM node:24-slim AS downloader
WORKDIR /app
COPY stocksprite/downloader/package*.json stocksprite/downloader/tsconfig.json ./
RUN npm ci
COPY stocksprite/downloader/src ./src
RUN npm run build
RUN npm prune --omit=dev

# ---- Stage 3: build the processor ----
FROM node:24-slim AS processor
WORKDIR /workspace
COPY packages/app-config/package*.json packages/app-config/
COPY packages/unas-json-client/package*.json packages/unas-json-client/
COPY packages/mapping-rules/package*.json packages/mapping-rules/
COPY stocksprite/processor/package*.json stocksprite/processor/
RUN cd stocksprite/processor && npm ci
COPY --from=packages /workspace/packages ./packages
COPY stocksprite/processor ./stocksprite/processor
RUN cd stocksprite/processor && npm run build
RUN cd stocksprite/processor && npm prune --omit=dev

# ---- Stage 4: runtime ----
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip csvkit bash tzdata openssh-client openssl \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Budapest
RUN ln -fs /usr/share/zoneinfo/Europe/Budapest /etc/localtime && dpkg-reconfigure -f noninteractive tzdata
WORKDIR /app
COPY --from=downloader /app/package.json ./downloader/package.json
COPY --from=downloader /app/node_modules ./downloader/node_modules
COPY --from=downloader /app/dist ./downloader/dist
COPY --from=processor /workspace/stocksprite/processor/package.json ./processor/package.json
COPY --from=processor /workspace/stocksprite/processor/node_modules ./processor/node_modules
COPY --from=processor /workspace/stocksprite/processor/dist ./processor/dist
COPY --from=processor /workspace/packages ./packages
# npm may install file: deps as symlinks whose target is absolute (/workspace/packages)
# from the build stage; replicate that path so the processor can resolve them at runtime.
COPY --from=processor /workspace/packages /workspace/packages
RUN mkdir -p /app/temp
ENV NODE_ENV=production
ENV OUTPUT_DIR=/app/temp
CMD ["sh","-c","cd /app/downloader && node dist/index.js && [ -z \"$TEST_CONNECTION\" ] && cd /app/processor && node dist/index.js"]
