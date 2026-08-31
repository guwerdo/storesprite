import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import { TYPES, ISchedulerService } from "../../di/index.js";
import { Util } from "../../utils/index.js";
import { requireInternalToken } from "./internalAuth.js";

export default function schedulerApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  fastify.addHook("preHandler", requireInternalToken);

  fastify.post("/run", async (request: FastifyRequest, reply: FastifyReply) => {
    const schedulerService = request.server.container.get<ISchedulerService>(TYPES.ISchedulerService);
    const logger = request.server.container.get<Logger>(TYPES.Logger);
    try {
      const result = await schedulerService.runDue(new Date());
      logger.info("Scheduler run completed", { dispatched: result.dispatched.length });
      return reply.code(200).send({ success: true, dispatched: result.dispatched });
    } catch (err: unknown) {
      logger.error("Scheduler run failed", { error: Util.stringifyError(err) });
      return reply.code(500).send({ error: "Scheduler run failed" });
    }
  });

  done();
}
