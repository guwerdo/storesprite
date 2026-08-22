import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import { TYPES, IUserService, IDataConnectionService } from "../di/index.js";

export default function workerApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  // Check X-Worker-Token header before executing routes in this plugin
  fastify.addHook("preHandler", (request: FastifyRequest, reply: FastifyReply, hookDone: (err?: Error) => void) => {
    const workerToken = request.headers["x-worker-token"];
    const validToken = process.env.INTERNAL_WORKER_TOKEN;

    if (!workerToken || !validToken || workerToken !== validToken) {
      const logger = request.server.container.get<Logger>(TYPES.Logger);
      logger.warn("Unauthorized worker API access attempt", { path: request.url });
      void reply.code(403).send({ error: "Forbidden: Invalid worker token" });
      return;
    }
    hookDone();
  });

  // Internal route to seed / create a user directly
  fastify.post("/users", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, email, name } = request.body as { id: string; email: string; name?: string };

    if (!id || !email) {
      return reply.code(400).send({ error: "Missing required fields: id, email" });
    }

    const userService = request.server.container.get<IUserService>(TYPES.IUserService);
    const logger = request.server.container.get<Logger>(TYPES.Logger);

    const user = await userService.createUser(id, email, name);
    logger.info("User created via worker API", { userId: user.id, email: user.email });

    return reply.code(201).send({ user });
  });

  // Internal route for workers to fetch user data connections
  fastify.get(
    "/users/:userId/connections",
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      const { userId } = request.params;
      const userService = request.server.container.get<IUserService>(TYPES.IUserService);
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const user = await userService.getUserById(userId);
      if (!user) {
        logger.warn("Worker API requested connections for non-existent user", { userId });
        return reply.code(404).send({ error: `User '${userId}' not found` });
      }

      const connections = await connectionService.getConnections(userId);
      logger.info("Worker API fetched user connections", { userId, count: connections.length });

      return reply.send({ connections });
    }
  );

  // Internal route for worker to fetch single connection configuration
  fastify.get(
    "/connections/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const connection = await connectionService.getConnectionByIdForWorker(id);
      if (!connection) {
        logger.warn("Worker requested non-existent connection", { id });
        return reply.code(404).send({ error: "Connection not found" });
      }

      return reply.send({ connection });
    }
  );

  // Internal route for worker to report connection test progress & final result
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
        const userId = (updated as unknown as { user?: { id: string }; userId?: string }).user?.id || (updated as unknown as { userId?: string }).userId;
        
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
        logger.error("Failed to save connection test result from worker", { id, error: String(err) });
        return reply.code(400).send({ error: (err as Error).message || "Invalid test result payload" });
      }
    }
  );

  done();
}
