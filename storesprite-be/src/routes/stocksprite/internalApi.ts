import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import { TYPES, IUserService, IDataConnectionService } from "../../di/index.js";
import { Util } from "../../utils/index.js";

export default function internalApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  const validToken = process.env.INTERNAL_TOKEN;

  // Check X-Internal-Token header before executing routes in this plugin
  fastify.addHook("preHandler", (request: FastifyRequest, reply: FastifyReply, hookDone: (err?: Error) => void) => {
    const token = request.headers["x-internal-token"];

    if (!token || !validToken || token !== validToken) {
      const logger = request.server.container.get<Logger>(TYPES.Logger);
      logger.warn("Unauthorized internal API access attempt", { path: request.url });
      void reply.code(403).send({ error: "Forbidden: Invalid internal token" });
      return;
    }
    hookDone();
  });

  // Internal route for the container to fetch user data connections
  fastify.get(
    "/users/:userId/connections",
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      const { userId } = request.params;
      const userService = request.server.container.get<IUserService>(TYPES.IUserService);
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const user = await userService.getUserById(userId);
      if (!user) {
        logger.warn("Internal API requested connections for non-existent user", { userId });
        return reply.code(404).send({ error: `User '${userId}' not found` });
      }

      const connections = await connectionService.getConnections(userId);
      logger.info("Internal API fetched user connections", { userId, count: connections.length });

      return reply.send({ connections });
    }
  );

  // Internal route for the container to fetch single connection configuration
  fastify.get(
    "/connections/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const connection = await connectionService.getConnectionByIdForWorker(id);
      if (!connection) {
        logger.warn("Internal API requested non-existent connection", { id });
        return reply.code(404).send({ error: "Connection not found" });
      }

      return reply.send({ connection });
    }
  );

  // Internal route for the container to report connection test progress & final result
  fastify.patch(
    "/connections/:id/test-result",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const body = request.body as Record<string, unknown>;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const updated = await connectionService.saveTestResult(id, body);
        if (!updated) {
          return reply.code(404).send({ error: "Connection not found" });
        }

        // Broadcast to tenant room via Socket.IO
        // Find user ID from connection
        const userId = updated.userId;

        if (userId) {
          const roomName = `tenant_${userId}`;
          if (body.progress === "finish") {
            fastify.io.to(roomName).emit("connection_test_result", {
              connectionId: id,
              testResult: updated.testResult,
            });
          } else {
            fastify.io.to(roomName).emit("connection_test_progress", {
              connectionId: id,
              progress: body.progress,
            });
          }
        } else {
          // If userId isn't top-level on DTO, emit to all or retrieve connection
          fastify.io.emit(body.progress === "finish" ? "connection_test_result" : "connection_test_progress", {
            connectionId: id,
            testResult: updated.testResult,
            progress: body.progress,
          });
        }

        return reply.code(204).send();
      } catch (err: unknown) {
        logger.error("Failed to save connection test result from container", { id, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Invalid test result payload" });
      }
    }
  );

  done();
}
