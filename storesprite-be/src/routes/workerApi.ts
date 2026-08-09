import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import { TYPES, IUserService } from "../di/index.js";

export default function workerApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  // Check X-Worker-Token header before executing routes in this plugin
  fastify.addHook("preHandler", (request: FastifyRequest, reply: FastifyReply, hookDone: (err?: Error) => void) => {
    const workerToken = request.headers["x-worker-token"];
    const validToken = process.env.WORKER_TOKEN || "mock_worker_token";

    if (!workerToken || workerToken !== validToken) {
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

  done();
}
