import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * In-process UNAS API server for the CSV→XML integration scenarios.
 *
 * It answers the client's login/getProductDB/setProduct calls over real HTTP,
 * serves the product-database CSV over a plain GET (as the processor downloads
 * it with axios), and records every raw setProduct body so the test can diff it
 * against a golden XML fixture.
 */

export interface FakeUnasRequest {
    method: string;
    url: string;
    headers: IncomingMessage["headers"];
    body: string;
}

export interface FakeUnasServer {
    /** Base URL (ends with `/shop/`) the run config points the UNAS client at. */
    baseUrl: string;
    /** Absolute URL served by this server with the product-database CSV. */
    productDbUrl: string;
    /** Every request the server received, in order. */
    requests: FakeUnasRequest[];
    /** Raw setProduct request bodies (one per batch sent by the processor). */
    setProductBodies: string[];
    close(): Promise<void>;
}

export interface FakeUnasServerOptions {
    /** Comma-delimited UNAS product-database CSV content. */
    dbCsv: string;
    /** SKU answered with `<Status>error</Status>` on setProduct (all others `ok`). */
    productErrorSku?: string;
}

const LOGIN_RESPONSE_XML = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Login>",
    "  <Token>int-token-123</Token>",
    "  <Expire>2099.12.31 23:59:59</Expire>",
    "  <ExpireTime>4102444799</ExpireTime>",
    "  <ShopId>83219</ShopId>",
    "  <Subscription>vip-100000</Subscription>",
    "  <Status>ok</Status>",
    "</Login>",
].join("\n");

function extractSkus(body: string): string[] {
    const skus: string[] = [];
    for (const match of body.matchAll(/<Sku>([^<]+)<\/Sku>/g)) {
        skus.push(match[1]);
    }
    return skus;
}

function buildSetProductResponse(skus: string[], errorSku?: string): string {
    const products = skus
        .map((sku) => {
            const status = sku === errorSku ? "error" : "ok";
            return (
                `<Product><Id>id-${sku}</Id><Sku>${sku}</Sku>` +
                `<Action>modify</Action><Status>${status}</Status></Product>`
            );
        })
        .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><Products>${products}</Products>`;
}

function collectBody(req: IncomingMessage): Promise<string> {
    return new Promise<string>((resolve) => {
        let rawBody = "";
        req.on("data", (chunk: Buffer) => {
            rawBody += chunk.toString("utf8");
        });
        req.on("end", () => resolve(rawBody));
    });
}

export async function startFakeUnasServer(options: FakeUnasServerOptions): Promise<FakeUnasServer> {
    const requests: FakeUnasRequest[] = [];
    const setProductBodies: string[] = [];

    let productDbUrl = "";
    const server: Server = createServer(async (req, res) => {
        const url = req.url ?? "/";
        const method = req.method ?? "GET";
        const body = await collectBody(req);
        requests.push({ method, url, headers: req.headers, body });

        if (method === "GET" && url.endsWith("/productdb.csv")) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.end(options.dbCsv);
            return;
        }
        if (url.endsWith("/login")) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/xml");
            res.end(LOGIN_RESPONSE_XML);
            return;
        }
        if (url.endsWith("/getProductDB")) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/xml");
            res.end(`<?xml version="1.0" encoding="UTF-8"?><getProductDB><Url>${productDbUrl}</Url></getProductDB>`);
            return;
        }
        if (url.endsWith("/setProduct")) {
            setProductBodies.push(body);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/xml");
            res.end(buildSetProductResponse(extractSkus(body), options.productErrorSku));
            return;
        }
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/xml");
        res.end("<Error>not found</Error>");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    if (address === null || typeof address === "string") {
        throw new Error("Failed to start fake UNAS server");
    }
    productDbUrl = `http://127.0.0.1:${address.port}/productdb.csv`;

    return {
        baseUrl: `http://127.0.0.1:${address.port}/shop/`,
        productDbUrl,
        requests,
        setProductBodies,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.closeAllConnections?.();
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}
