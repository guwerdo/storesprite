import { Container } from "inversify";
import { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    container: Container;
    io: Server;
  }
}
