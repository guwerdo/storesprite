import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import {
  TYPES,
  IMappingService,
  CreateMappingDto,
  UpdateMappingDto,
} from "../../di/index.js";
import { Util } from "../../utils/index.js";
import { MAPPING_RULES } from "@storesprite/mapping-rules";

export default function mappingsApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  // Protected route: GET /api/client/stocksprite/mappings/rules - Static rule dictionary
  fastify.get(
    "/stocksprite/mappings/rules",
    { config: { auth: true } },
    () => {
      return { rules: MAPPING_RULES };
    }
  );

  // Protected route: GET /api/client/stocksprite/mappings - List all mappings for current user
  fastify.get(
    "/stocksprite/mappings",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const mappingService = request.server.container.get<IMappingService>(TYPES.IMappingService);
      const mappings = await mappingService.getMappings(userId);
      return { mappings };
    }
  );

  // Protected route: GET /api/client/stocksprite/mappings/:id - Get single mapping
  fastify.get(
    "/stocksprite/mappings/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const mappingService = request.server.container.get<IMappingService>(TYPES.IMappingService);
      const mapping = await mappingService.getMappingById(id, userId);

      if (!mapping) {
        return reply.code(404).send({ error: "Mapping not found" });
      }

      return { mapping };
    }
  );

  // Protected route: GET /api/client/stocksprite/mappings/:id/history - Run history for a mapping
  fastify.get(
    "/stocksprite/mappings/:id/history",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const mappingService = request.server.container.get<IMappingService>(TYPES.IMappingService);
      const history = await mappingService.listHistory(id, userId);

      if (history === null) {
        return reply.code(404).send({ error: "Mapping not found" });
      }

      return { history };
    }
  );

  // Protected route: POST /api/client/stocksprite/mappings - Create a mapping
  fastify.post(
    "/stocksprite/mappings",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = request.body as CreateMappingDto;
      const mappingService = request.server.container.get<IMappingService>(TYPES.IMappingService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const created = await mappingService.createMapping(userId, body);
        return reply.code(201).send({ success: true, mapping: created });
      } catch (err: unknown) {
        logger.error("Failed to create mapping", { userId, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Failed to create mapping" });
      }
    }
  );

  // Protected route: PUT /api/client/stocksprite/mappings/:id - Update a mapping
  fastify.put(
    "/stocksprite/mappings/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const body = request.body as UpdateMappingDto;
      const mappingService = request.server.container.get<IMappingService>(TYPES.IMappingService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const updated = await mappingService.updateMapping(id, userId, body);
        if (!updated) {
          return reply.code(404).send({ error: "Mapping not found" });
        }
        return { success: true, mapping: updated };
      } catch (err: unknown) {
        logger.error("Failed to update mapping", { id, userId, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Failed to update mapping" });
      }
    }
  );

  // Protected route: DELETE /api/client/stocksprite/mappings/:id - Delete a mapping
  fastify.delete(
    "/stocksprite/mappings/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const mappingService = request.server.container.get<IMappingService>(TYPES.IMappingService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const deleted = await mappingService.deleteMapping(id, userId);
        if (!deleted) {
          return reply.code(404).send({ error: "Mapping not found" });
        }
        return { success: true, message: "Mapping deleted successfully" };
      } catch (err: unknown) {
        logger.error("Failed to delete mapping", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to delete mapping" });
      }
    }
  );

  // Protected route: POST /api/client/stocksprite/mappings/:id/run - Trigger a mapping run (stub)
  fastify.post(
    "/stocksprite/mappings/:id/run",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const mappingService = request.server.container.get<IMappingService>(TYPES.IMappingService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const ok = await mappingService.runMapping(id, userId);
        if (!ok) {
          return reply.code(404).send({ error: "Mapping not found" });
        }
        return reply.code(202).send({ success: true });
      } catch (err: unknown) {
        logger.error("Failed to trigger mapping run", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to trigger mapping run" });
      }
    }
  );

  done();
}
