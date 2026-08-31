import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import {
  TYPES,
  IDataConnectionService,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
  IConnectionTestRunnerService,
  IMappingService,
  CreateMappingDto,
  UpdateMappingDto,
} from "../../di/index.js";
import { Util } from "../../utils/index.js";
import { MAPPING_RULES } from "../../config/stocksprite/mapping-rules.js";

export default function stockspriteApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  // Protected route: GET /api/client/stocksprite/connections - List all connections for current user
  fastify.get(
    "/stocksprite/connections",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const connections = await connectionService.getConnections(userId);
      return { connections };
    }
  );

  // Protected route: GET /api/client/stocksprite/connections/:id - Get single connection details
  fastify.get(
    "/stocksprite/connections/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const connection = await connectionService.getConnectionById(id, userId);

      if (!connection) {
        return reply.code(404).send({ error: "Connection not found" });
      }

      return { connection };
    }
  );

  // Protected route: POST /api/client/stocksprite/connections - Create a new connection
  fastify.post(
    "/stocksprite/connections",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = request.body as CreateDataConnectionDto;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const created = await connectionService.createConnection(userId, body);
        return reply.code(201).send({ success: true, connection: created });
      } catch (err: unknown) {
        logger.error("Failed to create data connection", { userId, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Failed to create connection" });
      }
    }
  );

  // Protected route: PUT /api/client/stocksprite/connections/:id - Update an existing connection
  fastify.put(
    "/stocksprite/connections/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const body = request.body as UpdateDataConnectionDto;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const updated = await connectionService.updateConnection(id, userId, body);
        if (!updated) {
          return reply.code(404).send({ error: "Connection not found" });
        }
        return { success: true, connection: updated };
      } catch (err: unknown) {
        logger.error("Failed to update data connection", { id, userId, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Failed to update connection" });
      }
    }
  );

  // Protected route: DELETE /api/client/stocksprite/connections/:id - Delete a connection
  fastify.delete(
    "/stocksprite/connections/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const deleted = await connectionService.deleteConnection(id, userId);
        if (!deleted) {
          return reply.code(404).send({ error: "Connection not found" });
        }
        return { success: true, message: "Connection deleted successfully" };
      } catch (err: unknown) {
        logger.error("Failed to delete data connection", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to delete connection" });
      }
    }
  );

  // Protected route: POST /api/client/stocksprite/connections/:id/run-test - Trigger connection test
  fastify.post(
    "/stocksprite/connections/:id/run-test",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const runnerService = request.server.container.get<IConnectionTestRunnerService>(TYPES.IConnectionTestRunnerService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const connection = await connectionService.getConnectionById(id, userId);
      if (!connection) {
        return reply.code(404).send({ error: "Connection not found" });
      }

      try {
        const startedAt = new Date().toISOString();
        await connectionService.saveTestResult(id, {
          progress: "start",
          started_at: startedAt,
          finished_at: undefined,
          duration_ms: undefined,
          success: undefined,
          errorMessage: undefined,
        });

        // Broadcast progress start over Socket.IO to tenant room
        const roomName = `tenant_${userId}`;
        fastify.io.to(roomName).emit("connection_test_progress", {
          connectionId: id,
          progress: "start",
          started_at: startedAt,
        });

        const token = process.env.INTERNAL_TOKEN || "";
        const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://storesprite-be:3000";

        void runnerService.runTest(id, userId, token, backendUrl);

        return reply.code(202).send();
      } catch (err: unknown) {
        logger.error("Failed to trigger connection test", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to start connection test" });
      }
    }
  );

  // Protected route: GET /api/client/stocksprite/connections/:id/test-result - Retrieve test result
  fastify.get(
    "/stocksprite/connections/:id/test-result",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const connection = await connectionService.getConnectionById(id, userId);

      if (!connection) {
        return reply.code(404).send({ error: "Connection not found" });
      }

      return { testResult: connection.testResult ?? null };
    }
  );

  // Protected route: DELETE /api/client/stocksprite/connections/:id/test-result - Invalidate test result
  fastify.delete(
    "/stocksprite/connections/:id/test-result",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const success = await connectionService.invalidateConnection(id, userId);
        if (!success) {
          return reply.code(404).send({ error: "Connection not found" });
        }

        // Broadcast invalidation to tenant room
        const roomName = `tenant_${userId}`;
        fastify.io.to(roomName).emit("connection_test_invalidated", {
          connectionId: id,
          testResult: null,
        });

        return reply.code(204).send();
      } catch (err: unknown) {
        logger.error("Failed to invalidate connection test result", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to invalidate connection" });
      }
    }
  );

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
