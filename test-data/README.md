# UNAS Test Creator (`unas-test-creator`)

A standalone Node.js & TypeScript Dockerized utility designed to parse supplier CSV feeds (`cromwell`, `depiend`, `madalbal`, `magictools`, `stanley`) using their corresponding `-mapping.json` configuration files and generate a consolidated UNAS `setProduct` XML payload (`xml/payload.xml`).

---

## Features

- **Multi-Supplier Support**: Parses 5 supplier feeds (`cromwell`, `depiend`, `madalbal`, `magictools`, `stanley`) with custom column mappings.
- **Multi-Warehouse Stock Mapping**: Generates `<Stocks>` nodes with individual warehouse IDs and normalized quantity values.
- **Robust Field Handling**: Safely wraps textual content (`Name`, `Description`) in XML `CDATA` sections and escapes XML entities in SKUs and warehouse IDs.
- **Fallback for Missing Fields**: Feeds that only supply SKU/Stock (such as `madalbal` or `stanley`) gracefully produce valid XML with empty CDATA strings for `Name`/`Description`.
- **Pre-Built Container**: TypeScript source is compiled to `/workspace/dist` at image build time, with `tail -f /dev/null` keep-alive.

---

## Building the Docker Image

Build the Docker image tagged `unas-test-creator` directly from the `test-data` folder:

```bash
# From workspace root
docker build -t unas-test-creator ./test-data

# Or from within test-data/ folder
cd test-data
docker build -t unas-test-creator .
```

---

## Running the Container

### Option 1: Persistent Background Container (Recommended)

Start the container in the background without any volume mounts. It compiles TypeScript on start and stays alive:

```bash
docker run -d --name unas-test-creator -e UNAS_API_KEY="your-unas-api-key" unas-test-creator
```

Then execute commands interactively:

```bash
# Run payload generator
docker exec -it unas-test-creator npm start

# Run unit tests
docker exec -it unas-test-creator npm test

# Rebuild TypeScript
docker exec -it unas-test-creator npm run build

# Open interactive bash shell
docker exec -it unas-test-creator bash
```

### Option 2: One-Off Execution

Run the tests or application in a temporary container:

```bash
# Run tests
docker run --rm -e UNAS_API_KEY="your-unas-api-key" unas-test-creator npm test

# Run application
docker run --rm -e UNAS_API_KEY="your-unas-api-key" unas-test-creator npm start
```



## Directory Structure

```
test-data/
├── csv/
│   ├── cromwell-mapping.json
│   ├── cromwell.csv
│   ├── depiend-mapping.json
│   ├── depiend.csv
│   ├── madalbal-mapping.json
│   ├── madalbal.csv
│   ├── magictools-mapping.json
│   ├── magictools.csv
│   ├── stanley-mapping.json
│   └── stanley.csv
├── xml/
│   └── payload.xml               # Output target for generated UNAS XML payload
├── src/
│   ├── models/
│   │   └── types.ts              # Type definitions
│   ├── services/
│   │   ├── csv-parser-service.ts # CSV reader & stock normalizer
│   │   ├── xml-builder-service.ts# UNAS XML builder
│   │   └── payload-generator.ts  # Multi-feed orchestrator
│   └── index.ts                  # CLI entry point
├── tests/
│   ├── csv-parser-service.test.ts
│   └── xml-builder-service.test.ts
├── Dockerfile                    # Node:24-slim Docker build definition
├── .dockerignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## UNAS XML Output Format Example

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<Products>
    <Product>
        <Sku>ACN7321000K</Sku>
        <Action>add</Action>
        <Name> <![CDATA[Action Can. AS90 HEGESZTŐSPRAY 400ML]]> </Name>
        <Description>
            <Long>
                <![CDATA[ AS-90 Megakadályozza a hegesztési fröcskölések felhalmozódását... ]]>
            </Long>
        </Description>
        <Stocks>
            <Status>
                <Active>1</Active>
            </Status>
            <Stock>
                <WarehouseId>cromwell-stock-hu</WarehouseId>
                <IsActive>yes</IsActive>
                <Qty>10</Qty>
            </Stock>
            <Stock>
                <WarehouseId>cromwell-stock-cz</WarehouseId>
                <IsActive>yes</IsActive>
                <Qty>0</Qty>
            </Stock>
            <Stock>
                <WarehouseId>cromwell-stock-wdc</WarehouseId>
                <IsActive>yes</IsActive>
                <Qty>5</Qty>
            </Stock>
        </Stocks>		
        <Prices>
            <Vat>27%</Vat>
            <Price>
                <Type>normal</Type>
                <Net>100</Net>
                <Gross>200</Gross>
                <Actual>1</Actual>
            </Price>
        </Prices>
    </Product>
</Products>
```
