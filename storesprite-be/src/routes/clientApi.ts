import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, createClerkClient } from "@clerk/backend";
import type { Logger } from "log4js";
import { TYPES, IUserService, ISettingService, SaveUserSettingsDto } from "../di/index.js";
import { Util, type ClerkSessionClaims } from "../utils/index.js";

declare module "fastify" {
  interface FastifyRequest {
    userClaims?: ClerkSessionClaims;
  }
}

export default function clientApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const clerkClient = secretKey ? createClerkClient({ secretKey }) : null;

  // Global authentication & JIT user provisioning hook for clientApi
  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const routeConfig = request.routeOptions.config as { auth?: boolean } | undefined;
    if (routeConfig?.auth === false) {
      return; // Skip authentication for public endpoints
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized: Missing Bearer Token" });
    }

    const token = authHeader.split(" ")[1];
    try {
      let claims: ClerkSessionClaims | null = null;

      if (secretKey) {
        claims = await verifyToken(token, { secretKey });
      } else {
        claims = Util.decodeJwtPayload(token);
        if (!claims || !claims.sub) {
          claims = { sub: "mock_user_dev_id", email: "dev@localhost" };
        }
      }

      request.userClaims = claims;

      // JIT (Just-In-Time) user provisioning in PostgreSQL
      const userId = claims.sub;
      const userService = request.server.container.get<IUserService>(TYPES.IUserService);
      let user = await userService.getUserById(userId);

      if (!user) {
        let email = claims.email || claims.email_address;
        let name = claims.name || claims.first_name || undefined;

        const logger = request.server.container.get<Logger>(TYPES.Logger);

        // If claims don't include email or name, query Clerk SDK to fetch full user profile
        if ((!email || !name) && clerkClient) {
          try {
            const clerkUser = await clerkClient.users.getUser(userId);
            if (clerkUser) {
              email = email || clerkUser.emailAddresses?.[0]?.emailAddress;
              const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
              name = name || fullName || clerkUser.username || undefined;
            }
          } catch (err: unknown) {
            logger.warn("Could not fetch user details from Clerk SDK, using fallback", { error: Util.stringifyError(err) });
          }
        }

        const finalEmail = email || `${userId}@clerk.user`;
        user = await userService.createUser(userId, finalEmail, name);
        logger.info("User automatically provisioned JIT on authenticated request", { userId, email: finalEmail, name: name ?? "" });
      }
    } catch (err: unknown) {
      const logger = request.server.container.get<Logger>(TYPES.Logger);
      logger.error("Clerk JWT token verification failed", { error: Util.stringifyError(err) });
      return reply.code(401).send({ error: "Unauthorized: Invalid Token" });
    }
  });

  // Protected route (requires Clerk JWT): GET /api/client/settings
  fastify.get(
    "/settings",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const claims = request.userClaims;
      const userId = claims?.sub;

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const settingService = request.server.container.get<ISettingService>(TYPES.ISettingService);
      const [settings, languages] = await Promise.all([
        settingService.getUserSettings(userId),
        settingService.getAvailableLanguages(),
      ]);

      return {
        settings,
        languages: languages.map((lang) => ({ id: lang.id, code: lang.code })),
      };
    }
  );

  // Protected route (requires Clerk JWT): PUT /api/client/settings
  fastify.put(
    "/settings",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const claims = request.userClaims;
      const userId = claims?.sub;

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = (request.body || {}) as SaveUserSettingsDto;
      const settingService = request.server.container.get<ISettingService>(TYPES.ISettingService);

      try {
        const saved = await settingService.saveUserSettings(userId, {
          unasApiKey: body.unasApiKey ?? null,
          unasApiEndpoint: body.unasApiEndpoint ?? null,
          languageId: body.languageId ?? null,
        });

        return {
          success: true,
          settings: {
            unasApiKey: saved.unasApiKey ?? null,
            unasApiEndpoint: saved.unasApiEndpoint ?? "https://api.unas.eu/shop/",
            languageId: saved.language?.id ?? null,
          },
        };
      } catch (err: unknown) {
        const logger = request.server.container.get<Logger>(TYPES.Logger);
        logger.error("Failed to save user settings", { userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to save user settings" });
      }
    }
  );

  // Protected route (requires Clerk JWT): GET /api/client/me
  fastify.get(
    "/me",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const claims = request.userClaims;
      const userId = claims?.sub;

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const userService = request.server.container.get<IUserService>(TYPES.IUserService);
      const user = await userService.getUserById(userId);

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return { user };
    }
  );

  // Protected route: GET /api/client/hello-auth
  fastify.get(
    "/hello-auth",
    { config: { auth: true } },
    (request: FastifyRequest) => {
      const claims = request.userClaims;
      return {
        greetings: "hello authenticated user",
        userId: claims?.sub || "unknown",
      };
    }
  );

  // Public route within clientApi namespace: GET /api/client/hello
  fastify.get(
    "/hello",
    { config: { auth: false } },
    () => {
      return { greetings: "hello" };
    }
  );

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
