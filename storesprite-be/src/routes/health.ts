import { FastifyInstance } from "fastify";

export default function healthApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  // Public route within clientApi namespace: GET /api/client/status
  fastify.get(
    "/status",
    { config: { auth: false } },
    () => {
      return { status: "ok", service: "storesprite-be" };
    }
  );

  done();
}
