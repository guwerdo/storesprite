# UNAS Test Creator (`unas-test-creator`)

A standalone Node.js & TypeScript utility designed to parse supplier CSV feeds (`cromwell`, `depiend`, `madalbal`, `magictools`, `stanley`) using their corresponding `-mapping.json` configuration files, synchronize warehouses, and upload test products to a UNAS webshop via `@storesprite/unas-json-client`.

---

## Features

- **Typed JSON Client Integration**: Communicates with UNAS using `@storesprite/unas-json-client` (no manual XML concatenation, no manual token parsing).
- **Multi-Supplier Support**: Parses 5 supplier feeds (`cromwell`, `depiend`, `madalbal`, `magictools`, `stanley`) with column mappings.
- **Warehouse Synchronization**: Automatically queries UNAS warehouses with `client.getWarehouse()`, identifies missing warehouses, and creates them via `client.setWarehouse()` before processing products.
- **Batched Product Upload**: Converts parsed CSV rows into `ISetProduct[]` objects and batch-uploads them via `client.setProduct()`.
- **Dry-Run Mode**: Set `DRY_RUN=true` to parse feeds, sync warehouses, and prepare data without sending `setProduct` updates to the webshop.

---

## Configuration & Credentials

Provide your UNAS API key via environment variable or key file:

```bash
export UNAS_API_KEY="your-unas-api-key"
```

Or write it into `unas-api-key` file in the project directory.

---

## Development & Execution

```bash
# Run unit tests
npm test

# Build TypeScript
npm run build

# Run application (sync warehouses + batch upload products)
npm start

# Run in dry-run mode (skips setProduct upload)
DRY_RUN=true npm start
```

---

## Building the Docker Image

Build the multi-stage Docker image from repository root:

```bash
docker build -t unas-test-creator -f test-data/Dockerfile .
```

---

## Running in Docker

The `Dockerfile` defines `CMD ["tail", "-f", "/dev/null"]` as its default command, so the container remains running in the background automatically upon startup without needing local volume mounts.

### 1. Start the Container

```bash
# Start in the background
docker run -d --name unas-test-creator \
  -e UNAS_API_KEY="your-unas-api-key" \
  unas-test-creator
```

To enable debug mode at startup (logging all outgoing/incoming UNAS XML payloads with URLs):

```bash
docker run -d --name unas-test-creator \
  -e UNAS_API_KEY="your-unas-api-key" \
  -e DEBUG_UNAS_JSON_CLIENT="true" \
  unas-test-creator
```

### 2. Enter the Container

Open an interactive shell inside `/workspace/test-data`:

```bash
docker exec -it unas-test-creator bash
```

### 3. Run Commands Inside the Container

Once inside the container:

```bash
# Run unit tests
npm test

# Build TypeScript
npm run build

# Run in dry-run mode (syncs warehouses without uploading products)
DRY_RUN=true npm start

# Run full sync and product upload
npm start

# Run with UNAS XML debug logging enabled (prints sent and received XML payloads)
DEBUG_UNAS_JSON_CLIENT=true npm start
```

### 4. Stop & Remove the Container

```bash
docker stop unas-test-creator
docker rm unas-test-creator
```
