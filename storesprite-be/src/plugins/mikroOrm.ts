import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { MikroORM } from "@mikro-orm/postgresql";
import mikroOrmConfig from "../config/mikro-orm.config.js";

declare module "fastify" {
  interface FastifyInstance {
    orm: MikroORM;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  let orm: MikroORM;
  try {
    orm = await MikroORM.init(mikroOrmConfig);
    fastify.log.info("MikroORM connected to PostgreSQL database successfully");
  } catch (error) {
    fastify.log.error(error, "Failed to initialize MikroORM database connection");
    throw error;
  }

  fastify.decorate("orm", orm);

  // Close database connection when fastify shuts down
  fastify.addHook("onClose", async () => {
    await orm.close();
  });
});
