import { createServer, type IncomingMessage, type Server } from "node:http";

export interface IRecordedHttpRequest {
    method: string;
    url: string;
    headers: IncomingMessage["headers"];
    body: string;
}

export interface ITestHttpServer {
    baseUrl: string;
    requests: IRecordedHttpRequest[];
    close(): Promise<void>;
}

export type ResponseHandler = (request: IRecordedHttpRequest) => { status: number; body: string };

/** Start a real in-process HTTP server that records requests and answers via a handler. */
export async function startTestHttpServer(handler: ResponseHandler): Promise<ITestHttpServer> {
    const requests: IRecordedHttpRequest[] = [];

    const server: Server = createServer((req, res) => {
        let rawBody = "";
        req.on("data", (chunk: Buffer) => {
            rawBody += chunk.toString("utf8");
        });
        req.on("end", () => {
            const request: IRecordedHttpRequest = {
                method: req.method ?? "POST",
                url: req.url ?? "/",
                headers: req.headers,
                body: rawBody,
            };
            requests.push(request);
            const response = handler(request);
            res.statusCode = response.status;
            res.setHeader("Content-Type", "application/xml");
            res.end(response.body);
        });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    if (address === null || typeof address === "string") {
        throw new Error("Failed to start test HTTP server");
    }

    return {
        baseUrl: `http://127.0.0.1:${address.port}/shop/`,
        requests,
        close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
    };
}
