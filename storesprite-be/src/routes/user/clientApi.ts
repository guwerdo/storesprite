import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import { TYPES, ISettingService, IUserService, SaveUserSettingsDto } from "../../di/index.js";
import { Util } from "../../utils/index.js";
import { DEFAULT_UNAS_API_ENDPOINT } from "../../config/unas/unas.constants.js";
import { DEFAULT_TIMEZONE, ALLOWED_TIMEZONES } from "../../config/timezone.constants.js";

export default function userApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
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

      const timezone = body.timezone ?? null;
      if (timezone !== null && !ALLOWED_TIMEZONES.includes(timezone)) {
        return reply.code(400).send({ error: `Invalid timezone: ${timezone}` });
      }

      try {
        const saved = await settingService.saveUserSettings(userId, {
          unasApiKey: body.unasApiKey ?? null,
          unasApiEndpoint: body.unasApiEndpoint ?? null,
          languageId: body.languageId ?? null,
          timezone,
        });

        return {
          success: true,
          settings: {
            unasApiKey: saved.unasApiKey ?? null,
            unasApiEndpoint: saved.unasApiEndpoint ?? DEFAULT_UNAS_API_ENDPOINT,
            languageId: saved.language?.id ?? null,
            timezone: saved.timezone ?? DEFAULT_TIMEZONE,
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

  done();
}
