import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "log4js";
import type { IWarehouseResponse } from "@storesprite/unas-json-client";
import {
  TYPES,
  IUserService,
  IDataConnectionService,
  IMappingRepository,
  IMappingHistoryRepository,
  ISettingService,
  IUnasService,
} from "../../di/index.js";
import { Util } from "../../utils/index.js";
import { requireInternalToken } from "./internalAuth.js";

type ProgressEventName = "start" | "parse" | "download" | "compare" | "send" | "finish" | "error";

interface MappingProgressBody {
  runId: string;
  progress: ProgressEventName;
  error?: string;
  processedItems?: number;
  updatedItems?: number;
  unchangedItems?: number;
  warningCount?: number;
  errorCount?: number;
}

const mappingProgressSchema = {
  body: {
    type: "object",
    required: ["runId", "progress"],
    properties: {
      runId: { type: "string" },
      progress: {
        type: "string",
        enum: ["start", "parse", "download", "compare", "send", "finish", "error"],
      },
      error: { type: "string" },
      processedItems: { type: "integer", minimum: 0 },
      updatedItems: { type: "integer", minimum: 0 },
      unchangedItems: { type: "integer", minimum: 0 },
      warningCount: { type: "integer", minimum: 0 },
      errorCount: { type: "integer", minimum: 0 },
    },
  },
};

export default function internalApi(fastify: FastifyInstance, _opts: unknown, done: (err?: Error) => void): void {
  fastify.addHook("preHandler", requireInternalToken);

  // Internal route for the container to fetch user data connections
  fastify.get(
    "/users/:userId/connections",
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      const { userId } = request.params;
      const userService = request.server.container.get<IUserService>(TYPES.IUserService);
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const user = await userService.getUserById(userId);
      if (!user) {
        logger.warn("Internal API requested connections for non-existent user", { userId });
        return reply.code(404).send({ error: `User '${userId}' not found` });
      }

      const connections = await connectionService.getConnections(userId);
      logger.info("Internal API fetched user connections", { userId, count: connections.length });

      return reply.send({ connections });
    }
  );

  // Internal route for the container to fetch single connection configuration
  fastify.get(
    "/connections/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const connection = await connectionService.getConnectionByIdForWorker(id);
      if (!connection) {
        logger.warn("Internal API requested non-existent connection", { id });
        return reply.code(404).send({ error: "Connection not found" });
      }

      return reply.send({ connection });
    }
  );

  // Internal route for the container to report connection test progress & final result
  fastify.patch(
    "/connections/:id/test-result",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const body = request.body as Record<string, unknown>;
      const connectionService = request.server.container.get<IDataConnectionService>(TYPES.IDataConnectionService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      try {
        const updated = await connectionService.saveTestResult(id, body);
        if (!updated) {
          return reply.code(404).send({ error: "Connection not found" });
        }

        // Broadcast to tenant room via Socket.IO
        // Find user ID from connection
        const userId = updated.userId;

        if (userId) {
          const roomName = `tenant_${userId}`;
          if (body.progress === "finish") {
            fastify.io.to(roomName).emit("connection_test_result", {
              connectionId: id,
              testResult: updated.testResult,
            });
          } else {
            fastify.io.to(roomName).emit("connection_test_progress", {
              connectionId: id,
              progress: body.progress,
            });
          }
        } else {
          // If userId isn't top-level on DTO, emit to all or retrieve connection
          fastify.io.emit(body.progress === "finish" ? "connection_test_result" : "connection_test_progress", {
            connectionId: id,
            testResult: updated.testResult,
            progress: body.progress,
          });
        }

        return reply.code(204).send();
      } catch (err: unknown) {
        logger.error("Failed to save connection test result from container", { id, error: Util.stringifyError(err) });
        return reply.code(400).send({ error: (err as Error).message || "Invalid test result payload" });
      }
    }
  );

  // Internal route for the running worker container to fetch its run configuration
  fastify.get(
    "/mappings/:id/run-config",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const mappingRepository = request.server.container.get<IMappingRepository>(TYPES.IMappingRepository);
      const settingService = request.server.container.get<ISettingService>(TYPES.ISettingService);
      const unasService = request.server.container.get<IUnasService>(TYPES.IUnasService);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const mapping = await mappingRepository.getById(id);
      if (!mapping) {
        logger.warn("Internal run-config requested for non-existent mapping", { mappingId: id });
        return reply.code(404).send({ error: "Mapping not found" });
      }

      const userId = mapping.user.id;
      const settings = await settingService.getUserSettings(userId);

      // Without a configured API key there is nothing to resolve warehouses from and no run
      // can succeed; return the empty apiKey as-is so the processor rejects it and exits.
      let warehouses: IWarehouseResponse[] = [];
      if (settings?.unasApiKey) {
        warehouses = await unasService.getWarehouses(userId);
      }

      logger.info("Internal API served mapping run-config", {
        mappingId: id,
        userId,
        warehouseCount: warehouses.length,
      });

      return {
        mapping: {
          id: mapping.id,
          connectionId: mapping.connection.id,
          skuField: mapping.skuField,
          skuRules: mapping.skuRules ?? [],
          stockMappings: mapping.stockMappings,
        },
        unasConfig: {
          baseUrl: settings?.unasApiEndpoint ?? null,
          apiKey: settings?.unasApiKey ?? null,
        },
        warehouses,
      };
    }
  );

  // Internal route for the running worker container to report run progress. The row is
  // persisted only when the runId exists and belongs to this mapping; the event is always
  // relayed to the owning tenant's Socket.IO room.
  fastify.post(
    "/mappings/:id/progress",
    { schema: mappingProgressSchema },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const body = request.body as MappingProgressBody;
      const mappingRepository = request.server.container.get<IMappingRepository>(TYPES.IMappingRepository);
      const historyRepo = request.server.container.get<IMappingHistoryRepository>(TYPES.IMappingHistoryRepository);
      const logger = request.server.container.get<Logger>(TYPES.Logger);

      const mapping = await mappingRepository.getById(id);
      if (!mapping) {
        logger.warn("Internal progress reported for non-existent mapping", { mappingId: id });
        return reply.code(404).send({ error: "Mapping not found" });
      }

      const userId = mapping.user.id;

      const history = await historyRepo.findById(body.runId);
      if (history && history.mapping.id === id) {
        if (body.progress === "parse") {
          history.processedItems = body.processedItems ?? 0;
        } else if (body.progress === "finish") {
          const errorCount = body.errorCount ?? 0;
          history.updatedItems = body.updatedItems ?? 0;
          history.unchangedItems = body.unchangedItems ?? 0;
          history.warningCount = body.warningCount ?? 0;
          history.errorCount = errorCount;
          history.status = errorCount > 0 ? "partial" : "success";
          history.finishedAt = new Date();
        } else if (body.progress === "error") {
          history.error = body.error ?? null;
          history.status = "failed";
          history.finishedAt = new Date();
        }
        await historyRepo.save(history);
      }

      const roomName = `tenant_${userId}`;
      const event =
        body.progress === "finish" || body.progress === "error"
          ? "mapping_run_result"
          : "mapping_run_progress";
      fastify.io.to(roomName).emit(event, { mappingId: id, ...body });

      return reply.code(204).send();
    }
  );

  done();
}
