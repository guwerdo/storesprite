import Fastify, { FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import mikroOrmPlugin from "./plugins/mikroOrm.js";
import inversifyPlugin from "./plugins/inversify.js";
import socketioPlugin from "./plugins/socketio.js";
import clerkWebhooks from "./routes/clerkWebhooks.js";
import clientApi from "./routes/clientApi.js";
import internalApi from "./routes/stocksprite/internalApi.js";
import schedulerApi from "./routes/stocksprite/schedulerApi.js";

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  // Register CORS to allow direct requests from host browser
  app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register MikroORM first (if database configured/enabled)
  app.register(mikroOrmPlugin);

  // Register Plugins
  app.register(inversifyPlugin);
  app.register(socketioPlugin);

  // Register Routes
  app.register(clerkWebhooks, { prefix: "/api/clerk" });
  app.register(clientApi, { prefix: "/api/client" });
  app.register(internalApi, { prefix: "/api/internal/stocksprite" });
  app.register(schedulerApi, { prefix: "/api/internal/stocksprite/scheduler" });

  return app;
}
