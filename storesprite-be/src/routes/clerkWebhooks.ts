import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Webhook } from "svix";
import type { Logger } from "log4js";
import { TYPES, IUserRepository } from "../di/index.js";
import { Util } from "../utils/index.js";

interface ClerkUserWebhookData {
  id: string;
  email_addresses?: { email_address: string }[];
  first_name?: string;
  last_name?: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserWebhookData;
}

export default function clerkWebhooks(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  // Add a content type parser to preserve rawBody for Svix verification
  fastify.addContentTypeParser("application/json", { parseAs: "string" }, (req: FastifyRequest, body: string, parseDone) => {
    try {
      const json = JSON.parse(body) as Record<string, unknown>;
      (req as unknown as { rawBody: string }).rawBody = body;
      parseDone(null, json);
    } catch (err: unknown) {
      parseDone(err as Error, undefined);
    }
  });

  fastify.post("/webhooks/clerk", async (request: FastifyRequest, reply: FastifyReply) => {
    const svixId = request.headers["svix-id"] as string;
    const svixTimestamp = request.headers["svix-timestamp"] as string;
    const svixSignature = request.headers["svix-signature"] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      return reply.code(400).send({ error: "Missing Svix headers" });
    }

    const payload = (request as unknown as { rawBody?: string }).rawBody || JSON.stringify(request.body);
    const secret = process.env.CLERK_WEBHOOK_SECRET || "whsec_test_secret";

    try {
      const wh = new Webhook(secret);
      const evt = wh.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ClerkWebhookEvent;

      const userRepo = request.server.container.get<IUserRepository>(TYPES.IUserRepository);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      if (evt.type === "user.created") {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const email = email_addresses?.[0]?.email_address || "";
        const name = [first_name, last_name].filter(Boolean).join(" ");

        const user = await userRepo.add({ id, email, name: name || undefined });
        logger.info("User synchronized on create", { userId: user.id });
      } else if (evt.type === "user.updated") {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const email = email_addresses?.[0]?.email_address;
        const name = [first_name, last_name].filter(Boolean).join(" ");

        await userRepo.update(id, {
          ...(email ? { email } : {}),
          ...(name ? { name } : {}),
        });
        logger.info("User synchronized on update", { userId: id });
      } else if (evt.type === "user.deleted") {
        const { id } = evt.data;
        if (id) {
          await userRepo.delete(id);
          logger.info("User deleted on clerk event", { userId: id });
        }
      }

      return reply.code(200).send({ success: true });
    } catch (err: unknown) {
      const logger = request.server.container.get<Logger>(TYPES.Logger);
      logger.error("Webhook verification failed", { error: Util.stringifyError(err) });
      return reply.code(400).send({ error: "Webhook verification failed" });
    }
  });

  done();
}
