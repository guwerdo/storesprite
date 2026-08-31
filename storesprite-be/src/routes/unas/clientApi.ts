import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import { TYPES, IUnasService } from "../../di/index.js";
import { Util } from "../../utils/index.js";
import { UnasConfigError, UnasHttpError, UnasTransportError } from "@storesprite/unas-json-client";

export default function unasApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  // Protected route (requires Clerk JWT): POST /api/client/unas/login
  fastify.post(
    "/unas/login",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const unasService = request.server.container.get<IUnasService>(TYPES.IUnasService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const connection = await unasService.login(userId);
        return { connection };
      } catch (err: unknown) {
        if (err instanceof UnasConfigError) {
          return reply.code(400).send({ error: "UNAS API key is not configured" });
        }

        logger.error("UNAS login failed", { userId, error: Util.stringifyError(err) });

        if (err instanceof UnasHttpError || err instanceof UnasTransportError) {
          return reply.code(502).send({ error: "UNAS login failed" });
        }
        return reply.code(500).send({ error: "Failed to save UNAS connection" });
      }
    }
  );

  // Protected route: GET /api/client/unas/warehouse - List the user's UNAS warehouses
  fastify.get(
    "/unas/warehouse",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const unasService = request.server.container.get<IUnasService>(TYPES.IUnasService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const warehouses = await unasService.getWarehouses(userId);
        return { warehouses };
      } catch (err: unknown) {
        if (err instanceof UnasConfigError) {
          return reply.code(400).send({ error: "UNAS API key is not configured" });
        }

        logger.error("Failed to fetch UNAS warehouses", { userId, error: Util.stringifyError(err) });

        if (err instanceof UnasHttpError || err instanceof UnasTransportError) {
          return reply.code(502).send({ error: "Failed to fetch UNAS warehouses" });
        }
        return reply.code(500).send({ error: "Failed to fetch UNAS warehouses" });
      }
    }
  );

  done();
}
