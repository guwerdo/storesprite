import { Container } from "inversify";
import { Server } from "socket.io";
import type { MikroORM } from "@mikro-orm/postgresql";
import type { ClerkSessionClaims } from "../utils/jwt-util.js";

declare module "fastify" {
  interface FastifyInstance {
    container: Container;
    io: Server;
    orm: MikroORM;
  }

  interface FastifyRequest {
    userClaims?: ClerkSessionClaims;
  }
}
