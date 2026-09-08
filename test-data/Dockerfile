FROM node:24-slim

# System tooling: tzdata, bash, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash tzdata curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set timezone
ENV TZ=Europe/Budapest
RUN ln -fs /usr/share/zoneinfo/Europe/Budapest /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata

WORKDIR /workspace

# Copy package definitions and install dependencies
COPY package.json tsconfig.json ./
RUN npm install

# Copy source and compile TypeScript into dist/
COPY src/ ./src/
COPY tests/ ./tests/
RUN npm run build

# Copy CSV files and mapping configurations
COPY csv/ ./csv/

# Prepare xml output directory
RUN mkdir -p /workspace/xml

# Keep container alive on startup so commands can be executed via docker exec
CMD ["sh", "-c", "tail -f /dev/null"]
