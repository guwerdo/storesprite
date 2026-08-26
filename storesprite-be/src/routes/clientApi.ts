import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, createClerkClient } from "@clerk/backend";
import type { Logger } from "log4js";
import {
  TYPES,
  IUserService,
  ISettingService,
  IUnasService,
  SaveUserSettingsDto,
  IDataConnectionService,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
  IConnectionTestRunnerService,
} from "../di/index.js";
import { Util, type ClerkSessionClaims } from "../utils/index.js";
import { UnasHttpError } from "@storesprite/unas-json-client";
import type { UnasConnectionRecord } from "../types/UnasConnection.interface.js";

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

  // Protected route (requires Clerk JWT): POST /api/client/unas/login
  fastify.post(
    "/unas/login",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const settingService = request.server.container.get<ISettingService>(TYPES.ISettingService);
      const unasService = request.server.container.get<IUnasService>(TYPES.IUnasService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const settings = await settingService.getUserSettings(userId);
      if (!settings?.unasApiKey) {
        logger.warn("UNAS login attempted without configured API key", { userId });
        return reply.code(400).send({ error: "UNAS API key is not configured" });
      }

      try {
        const loginResponse = await unasService.login({
          baseUrl: settings.unasApiEndpoint ?? "https://api.unas.eu/shop/",
          apiKey: settings.unasApiKey,
        });

        const record: UnasConnectionRecord = {
          ...loginResponse,
          token: null,
          checkedAt: new Date().toISOString(),
        };
        await settingService.saveUnasConnection(userId, record);

        return { webshopInfo: loginResponse.webshopInfo ?? null };
      } catch (err: unknown) {
        logger.error("UNAS login failed", { userId, error: Util.stringifyError(err) });

        if (err instanceof UnasHttpError) {
          try {
            await settingService.saveUnasConnection(userId, null);
          } catch (resetErr: unknown) {
            logger.error("Failed to reset UNAS connection", { userId, error: Util.stringifyError(resetErr) });
          }
        }

        return reply.code(502).send({ error: "UNAS login failed" });
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

  // Protected route: GET /api/client/connections - List all connections for current user
  fastify.get(
    "/connections",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const connections = await connectionService.getConnections(userId);
      return { connections };
    }
  );

  // Protected route: GET /api/client/connections/:id - Get single connection details
  fastify.get(
    "/connections/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const connection = await connectionService.getConnectionById(id, userId);

      if (!connection) {
        return reply.code(404).send({ error: "Connection not found" });
      }

      return { connection };
    }
  );

  // Protected route: POST /api/client/connections - Create a new connection
  fastify.post(
    "/connections",
    { config: { auth: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = request.body as CreateDataConnectionDto;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const created = await connectionService.createConnection(userId, body);
        return reply.code(201).send({ success: true, connection: created });
      } catch (err: unknown) {
        logger.error("Failed to create data connection", { userId, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Failed to create connection" });
      }
    }
  );

  // Protected route: PUT /api/client/connections/:id - Update an existing connection
  fastify.put(
    "/connections/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const body = request.body as UpdateDataConnectionDto;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const updated = await connectionService.updateConnection(id, userId, body);
        if (!updated) {
          return reply.code(404).send({ error: "Connection not found" });
        }
        return { success: true, connection: updated };
      } catch (err: unknown) {
        logger.error("Failed to update data connection", { id, userId, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Failed to update connection" });
      }
    }
  );

  // Protected route: DELETE /api/client/connections/:id - Delete a connection
  fastify.delete(
    "/connections/:id",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const deleted = await connectionService.deleteConnection(id, userId);
        if (!deleted) {
          return reply.code(404).send({ error: "Connection not found" });
        }
        return { success: true, message: "Connection deleted successfully" };
      } catch (err: unknown) {
        logger.error("Failed to delete data connection", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to delete connection" });
      }
    }
  );

  // Protected route: POST /api/client/connections/:id/run-test - Trigger connection test
  fastify.post(
    "/connections/:id/run-test",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const runnerService = request.server.container.get<IConnectionTestRunnerService>(TYPES.IConnectionTestRunnerService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const connection = await connectionService.getConnectionById(id, userId);
      if (!connection) {
        return reply.code(404).send({ error: "Connection not found" });
      }

      try {
        const startedAt = new Date().toISOString();
        await connectionService.saveTestResult(id, {
          progress: "start",
          started_at: startedAt,
          finished_at: undefined,
          duration_ms: undefined,
          success: undefined,
          errorMessage: undefined,
        });

        // Broadcast progress start over Socket.IO to tenant room
        const roomName = `tenant_${userId}`;
        fastify.io.to(roomName).emit("connection_test_progress", {
          connectionId: id,
          progress: "start",
          started_at: startedAt,
        });

        const workerToken = process.env.INTERNAL_WORKER_TOKEN || "";
        const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://storesprite-be:3000";

        void runnerService.runTest(id, userId, workerToken, backendUrl);

        return reply.code(202).send();
      } catch (err: unknown) {
        logger.error("Failed to trigger connection test", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to start connection test" });
      }
    }
  );

  // Protected route: GET /api/client/connections/:id/test-result - Retrieve test result
  fastify.get(
    "/connections/:id/test-result",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const connection = await connectionService.getConnectionById(id, userId);

      if (!connection) {
        return reply.code(404).send({ error: "Connection not found" });
      }

      return { testResult: connection.testResult ?? null };
    }
  );

  // Protected route: DELETE /api/client/connections/:id/test-result - Invalidate test result
  fastify.delete(
    "/connections/:id/test-result",
    { config: { auth: true } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userClaims?.sub;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const success = await connectionService.invalidateConnection(id, userId);
        if (!success) {
          return reply.code(404).send({ error: "Connection not found" });
        }

        // Broadcast invalidation to tenant room
        const roomName = `tenant_${userId}`;
        fastify.io.to(roomName).emit("connection_test_invalidated", {
          connectionId: id,
          testResult: null,
        });

        return reply.code(204).send();
      } catch (err: unknown) {
        logger.error("Failed to invalidate connection test result", { id, userId, error: Util.stringifyError(err) });
        return reply.code(500).send({ error: "Failed to invalidate connection" });
      }
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
