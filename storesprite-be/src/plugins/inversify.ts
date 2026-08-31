import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { createContainer } from "../di/container.js";

export default fp((fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
  const container = createContainer(fastify.orm);

  // Decorate the fastify instance with the DI container
  fastify.decorate("container", container);

  done();
});
