# Multi-stage Docker build with repo-root context
FROM node:24-slim AS packages
WORKDIR /workspace
COPY packages/unas-json-client ./packages/unas-json-client
RUN cd packages/unas-json-client && npm ci && npm run build

FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash tzdata curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Budapest
RUN ln -fs /usr/share/zoneinfo/Europe/Budapest /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata

WORKDIR /workspace
COPY --from=packages /workspace/packages ./packages
COPY test-data/package.json test-data/tsconfig.json ./test-data/
RUN cd test-data && npm install

COPY test-data/src/ ./test-data/src/
COPY test-data/tests/ ./test-data/tests/
COPY test-data/csv/ ./test-data/csv/
RUN mkdir -p /workspace/test-data/xml

WORKDIR /workspace/test-data
RUN npm run build

CMD ["tail", "-f", "/dev/null"]
