import fp from "fastify-plugin";
import { Server } from "socket.io";
import { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

export default fp((fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
  const io = new Server(fastify.server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  fastify.decorate("io", io);

  fastify.addHook("onClose", (_instance, onCloseDone) => {
    void io.close();
    onCloseDone();
  });

  io.on("connection", (socket) => {
    fastify.log.info(`Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      fastify.log.info(`Client disconnected: ${socket.id}`);
    });
  });

  done();
});
