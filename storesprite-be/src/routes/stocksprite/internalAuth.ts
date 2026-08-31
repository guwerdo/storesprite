import { FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import { TYPES } from "../../di/index.js";

export function requireInternalToken(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void
): void {
  const validToken = process.env.INTERNAL_TOKEN;
  const token = request.headers["x-internal-token"];

  if (!token || !validToken || token !== validToken) {
    const logger = request.server.container.get<Logger>(TYPES.Logger);
    logger.warn("Unauthorized internal API access attempt", { path: request.url });
    void reply.code(403).send({ error: "Forbidden: Invalid internal token" });
    return;
  }

  done();
}
