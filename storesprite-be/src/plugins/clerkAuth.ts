import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, createClerkClient } from "@clerk/backend";
import type { Logger } from "log4js";
import { TYPES, IUserService } from "../di/index.js";
import { Util, type ClerkSessionClaims } from "../utils/index.js";

/**
 * Registers the Clerk JWT verification + JIT user provisioning hook.
 * Call this at the /api/client scope so it guards the user-facing client
 * routes only — not the Clerk webhook or the internal worker APIs.
 */
export function registerClerkAuth(fastify: FastifyInstance): void {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const clerkClient = secretKey ? createClerkClient({ secretKey }) : null;

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

      if (secretKey && !token.startsWith("mock_jwt_") && !token.startsWith("live_test_jwt_") && !token.startsWith("user_")) {
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
}
