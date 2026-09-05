import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../../src/plugins/mikroOrm.js", () => ({
  default: Object.assign(async () => {}, { [Symbol.for("fastify.display-name")]: "mikroOrmPlugin" }),
}));

import { buildApp } from "../../../../src/app.js";
import { TYPES } from "../../../../src/di/index.js";
import type { IMappingRepository } from "../../../../src/types/stocksprite/MappingRepository.interface.js";
import type { IMappingHistoryRepository } from "../../../../src/types/stocksprite/MappingHistoryRepository.interface.js";
import type { ISettingService } from "../../../../src/types/user/SettingService.interface.js";
import type { IUnasService } from "../../../../src/types/unas/UnasService.interface.js";
import { Mapping } from "../../../../src/entities/stocksprite/Mapping.js";
import { DataConnection } from "../../../../src/entities/stocksprite/DataConnection.js";
import { User } from "../../../../src/entities/user/User.js";

describe("Internal API run-config + progress (Mocked Dependencies)", () => {
  let app: any;

  const mappingRepositoryMock: IMappingRepository = {
    getAllByUserId: vi.fn(),
    getByIdAndUserId: vi.fn(),
    getById: vi.fn(),
    getByConnectionIdAndUserId: vi.fn(),
    getEnabledSchedules: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    markLastRun: vi.fn(),
  };

  const historyRepositoryMock: IMappingHistoryRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    markRunningAsFailed: vi.fn(),
    markStaleRunningFailed: vi.fn(),
    prune: vi.fn(),
    listByMapping: vi.fn(),
  };

  const settingServiceMock: ISettingService = {
    getUserSettings: vi.fn(),
    saveUserSettings: vi.fn(),
    getAvailableLanguages: vi.fn(),
    saveUnasConnection: vi.fn(),
  };

  const unasServiceMock: IUnasService = {
    login: vi.fn(),
    getWarehouses: vi.fn(),
  };

  const user = new User("u1", "u1@t.com", "U");
  const conn = new DataConnection(
    user,
    "Feed",
    "HTTP",
    "CSV",
    { channel: "HTTP", url: "https://x" },
    { format: "CSV", delimiter: ";" },
    true,
    null,
    { success: true, columns: ["sku", "stock"] }
  );
  conn.id = "conn1";

  const mapping = new Mapping(user, conn, "M", "sku", []);
  mapping.id = "map1";
  mapping.skuRules = [];
  mapping.stockMappings = [{ column: "stock", warehouseId: 2 }];

  beforeAll(async () => {
    process.env.INTERNAL_TOKEN = "mock_internal_token";
    app = buildApp({ logger: false });
    await app.ready();
    app.container.rebind(TYPES.IMappingRepository).toConstantValue(mappingRepositoryMock);
    app.container.rebind(TYPES.IMappingHistoryRepository).toConstantValue(historyRepositoryMock);
    app.container.rebind(TYPES.ISettingService).toConstantValue(settingServiceMock);
    app.container.rebind(TYPES.IUnasService).toConstantValue(unasServiceMock);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.INTERNAL_TOKEN;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const internalHeaders = { "x-internal-token": "mock_internal_token" };

  describe("GET /api/internal/stocksprite/mappings/:id/run-config", () => {
    it("returns the run configuration for an existing mapping", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      (settingServiceMock.getUserSettings as any).mockResolvedValue({
        timezone: "Europe/Budapest",
        unasApiEndpoint: "https://unas.example",
        unasApiKey: "sekret",
      });
      (unasServiceMock.getWarehouses as any).mockResolvedValue([{ id: 1, name: "Main", publicName: "Main warehouse" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/internal/stocksprite/mappings/map1/run-config",
        headers: internalHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.mapping).toEqual({
        id: "map1",
        connectionId: "conn1",
        skuField: "sku",
        skuRules: [],
        stockMappings: [{ column: "stock", warehouseId: 2 }],
      });
      expect(body.unasConfig).toEqual({ baseUrl: "https://unas.example", apiKey: "sekret" });
      expect(body.warehouses).toEqual([{ id: 1, name: "Main", publicName: "Main warehouse" }]);
      expect(unasServiceMock.getWarehouses).toHaveBeenCalledWith("u1");
    });

    it("returns an empty warehouse list and never calls UNAS when no API key is configured", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      (settingServiceMock.getUserSettings as any).mockResolvedValue({
        timezone: "Europe/Budapest",
        unasApiEndpoint: "https://unas.example",
        unasApiKey: null,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/internal/stocksprite/mappings/map1/run-config",
        headers: internalHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.unasConfig.apiKey).toBeNull();
      expect(body.warehouses).toEqual([]);
      expect(unasServiceMock.getWarehouses).not.toHaveBeenCalled();
    });

    it("returns 404 when the mapping does not exist", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/internal/stocksprite/mappings/nope/run-config",
        headers: internalHeaders,
      });

      expect(response.statusCode).toBe(404);
    });

    it("rejects a request without the internal token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/internal/stocksprite/mappings/map1/run-config",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/internal/stocksprite/mappings/:id/progress", () => {
    const makeRow = (status = "running", mappingId = "map1") => ({
      id: "run1",
      mapping: { id: mappingId },
      status,
      trigger: "schedule",
      startedAt: new Date("2026-08-01T10:00:00Z"),
      processedItems: 0,
      updatedItems: 0,
      unchangedItems: 0,
      warningCount: 0,
      errorCount: 0,
      error: null,
      skuNormalizations: null,
    });

    it("persists parse progress and relays a progress event", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      const row = makeRow();
      (historyRepositoryMock.findById as any).mockResolvedValue(row);
      const emitSpy = vi.fn();
      vi.spyOn(app.io, "to").mockReturnValue({ emit: emitSpy } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: { runId: "run1", progress: "parse", processedItems: 42 },
      });

      expect(response.statusCode).toBe(204);
      expect(row.processedItems).toBe(42);
      expect(historyRepositoryMock.save).toHaveBeenCalledWith(row);
      expect(app.io.to).toHaveBeenCalledWith("tenant_u1");
      expect(emitSpy).toHaveBeenCalledWith("mapping_run_progress", {
        mappingId: "map1",
        runId: "run1",
        progress: "parse",
        processedItems: 42,
      });
    });

    it("derives status success from a clean finish", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      const row = makeRow();
      (historyRepositoryMock.findById as any).mockResolvedValue(row);
      vi.spyOn(app.io, "to").mockReturnValue({ emit: vi.fn() } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: {
          runId: "run1",
          progress: "finish",
          updatedItems: 10,
          unchangedItems: 5,
          warningCount: 1,
          errorCount: 0,
        },
      });

      expect(response.statusCode).toBe(204);
      expect(row.status).toBe("success");
      expect(row.updatedItems).toBe(10);
      expect(row.unchangedItems).toBe(5);
      expect(row.warningCount).toBe(1);
      expect(row.errorCount).toBe(0);
      expect(row.finishedAt).toBeInstanceOf(Date);
      expect(historyRepositoryMock.save).toHaveBeenCalledWith(row);
    });

    it("derives status partial from a finish with product errors", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      const row = makeRow();
      (historyRepositoryMock.findById as any).mockResolvedValue(row);
      vi.spyOn(app.io, "to").mockReturnValue({ emit: vi.fn() } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: { runId: "run1", progress: "finish", errorCount: 3 },
      });

      expect(response.statusCode).toBe(204);
      expect(row.status).toBe("partial");
      expect(historyRepositoryMock.save).toHaveBeenCalledWith(row);
    });

    it("derives status failed and stores the error from an error report", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      const row = makeRow();
      (historyRepositoryMock.findById as any).mockResolvedValue(row);
      vi.spyOn(app.io, "to").mockReturnValue({ emit: vi.fn() } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: { runId: "run1", progress: "error", error: "boom" },
      });

      expect(response.statusCode).toBe(204);
      expect(row.status).toBe("failed");
      expect(row.error).toBe("boom");
      expect(row.finishedAt).toBeInstanceOf(Date);
      expect(historyRepositoryMock.save).toHaveBeenCalledWith(row);
    });

    it("persists skuNormalizations from a valid finish", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      const row = makeRow();
      (historyRepositoryMock.findById as any).mockResolvedValue(row);
      vi.spyOn(app.io, "to").mockReturnValue({ emit: vi.fn() } as never);

      const skuNormalizations = {
        converted: { count: 2, examples: [{ before: "123.ASD", after: "123_ASD" }] },
        truncated: { count: 0, examples: [] },
      };
      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: { runId: "run1", progress: "finish", updatedItems: 1, errorCount: 0, skuNormalizations },
      });

      expect(response.statusCode).toBe(204);
      expect(row.status).toBe("success");
      expect(row.skuNormalizations).toEqual(skuNormalizations);
      expect(historyRepositoryMock.save).toHaveBeenCalledWith(row);
    });

    it("hard-fails with 400 and marks the run failed when skuNormalizations is malformed", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      const row = makeRow();
      (historyRepositoryMock.findById as any).mockResolvedValue(row);
      const emitSpy = vi.fn();
      vi.spyOn(app.io, "to").mockReturnValue({ emit: emitSpy } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: {
          runId: "run1",
          progress: "finish",
          errorCount: 0,
          skuNormalizations: { converted: { count: "x", examples: [] }, truncated: { count: 0, examples: [] } },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(row.status).toBe("failed");
      expect(row.error).toContain("sku normalizations");
      expect(row.finishedAt).toBeInstanceOf(Date);
      expect(historyRepositoryMock.save).toHaveBeenCalledWith(row);
      // The 400 return happens before the finish relay is emitted.
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("relays but does not persist when the runId belongs to another mapping", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      const row = makeRow("running", "other-mapping");
      (historyRepositoryMock.findById as any).mockResolvedValue(row);
      const emitSpy = vi.fn();
      vi.spyOn(app.io, "to").mockReturnValue({ emit: emitSpy } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: { runId: "run1", progress: "start" },
      });

      expect(response.statusCode).toBe(204);
      expect(historyRepositoryMock.save).not.toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith("mapping_run_progress", {
        mappingId: "map1",
        runId: "run1",
        progress: "start",
      });
    });

    it("relays but does not persist when the runId is unknown", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);
      (historyRepositoryMock.findById as any).mockResolvedValue(null);
      vi.spyOn(app.io, "to").mockReturnValue({ emit: vi.fn() } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: { runId: "ghost", progress: "start" },
      });

      expect(response.statusCode).toBe(204);
      expect(historyRepositoryMock.save).not.toHaveBeenCalled();
    });

    it("returns 404 when the mapping does not exist", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/nope/progress",
        headers: internalHeaders,
        payload: { runId: "run1", progress: "start" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns 400 when the body does not match the schema", async () => {
      (mappingRepositoryMock.getById as any).mockResolvedValue(mapping);

      const response = await app.inject({
        method: "POST",
        url: "/api/internal/stocksprite/mappings/map1/progress",
        headers: internalHeaders,
        payload: { runId: "run1", progress: "bogus" },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
