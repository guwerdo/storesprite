import { FastifyInstance } from "fastify";
import { registerClerkAuth } from "../../plugins/clerkAuth.js";
import userApi from "../user/clientApi.js";
import unasApi from "../unas/clientApi.js";
import stockspriteApi from "../stocksprite/clientApi.js";
import healthApi from "../health.js";

/**
 * Client-facing API router. Applies the Clerk auth hook to the whole
 * /api/client scope, then registers the per-domain route plugins.
 */
export default async function clientApi(fastify: FastifyInstance): Promise<void> {
  registerClerkAuth(fastify);

  await fastify.register(userApi);
  await fastify.register(unasApi);
  await fastify.register(stockspriteApi);
  await fastify.register(healthApi);
}
