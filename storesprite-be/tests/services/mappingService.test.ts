import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { MappingService } from "../../src/services/stocksprite/MappingService.js";
import { IMappingRepository } from "../../src/types/stocksprite/MappingRepository.interface.js";
import { IDataConnectionRepository } from "../../src/types/stocksprite/DataConnectionRepository.interface.js";
import { DataConnection } from "../../src/entities/stocksprite/DataConnection.js";
import { User } from "../../src/entities/User.js";
import { Mapping } from "../../src/entities/stocksprite/Mapping.js";
import { JsonSchemaValidator } from "../../src/utils/JsonSchemaValidator.js";

describe("MappingService Unit Tests", () => {
  let repositoryMock: ReturnType<typeof mock<IMappingRepository>>;
  let dataConnectionRepositoryMock: ReturnType<typeof mock<IDataConnectionRepository>>;
  let service: MappingService;
  const mockUser = new User("user_123", "test@storesprite.com", "Test User");

  const makeTestedConnection = (): DataConnection =>
    new DataConnection(
      mockUser,
      "Feed",
      "HTTP",
      "CSV",
      { channel: "HTTP", url: "https://example.com/feed.csv" },
      { format: "CSV", delimiter: ";" },
      false,
      null,
      { success: true, columns: ["sku", "stock"] }
    );

  beforeEach(() => {
    repositoryMock = mock<IMappingRepository>();
    dataConnectionRepositoryMock = mock<IDataConnectionRepository>();
    service = new MappingService(repositoryMock, dataConnectionRepositoryMock, new JsonSchemaValidator());
  });

  it("rejects an untested connection", async () => {
    const untested = makeTestedConnection();
    untested.testResult = { success: false };
    dataConnectionRepositoryMock.getByIdAndUserId.mockResolvedValue(untested);

    await expect(
      service.createMapping("user_123", {
        name: "Cromwell",
        connectionId: "c1",
        skuField: "sku",
        stockMappings: [],
      })
    ).rejects.toThrow("Connection must be tested before creating a mapping");
  });

  it("rejects an unknown rule operation", async () => {
    dataConnectionRepositoryMock.getByIdAndUserId.mockResolvedValue(makeTestedConnection());
    repositoryMock.getByConnectionIdAndUserId.mockResolvedValue(null);

    await expect(
      service.createMapping("user_123", {
        name: "Cromwell",
        connectionId: "c1",
        skuField: "sku",
        stockMappings: [{ column: "stock", warehouseId: 1, rules: [{ op: "foo", params: {} }] }],
      })
    ).rejects.toThrow("Unknown rule operation: foo");
  });

  it("rejects a rule used in the wrong group", async () => {
    dataConnectionRepositoryMock.getByIdAndUserId.mockResolvedValue(makeTestedConnection());
    repositoryMock.getByConnectionIdAndUserId.mockResolvedValue(null);

    await expect(
      service.createMapping("user_123", {
        name: "Cromwell",
        connectionId: "c1",
        skuField: "sku",
        skuRules: [{ op: "multiply", params: { value: 3 } }],
        stockMappings: [],
      })
    ).rejects.toThrow("is not available in the 'sku' group");
  });

  it("rejects duplicate columns", async () => {
    dataConnectionRepositoryMock.getByIdAndUserId.mockResolvedValue(makeTestedConnection());
    repositoryMock.getByConnectionIdAndUserId.mockResolvedValue(null);

    await expect(
      service.createMapping("user_123", {
        name: "Cromwell",
        connectionId: "c1",
        skuField: "sku",
        stockMappings: [
          { column: "stock", warehouseId: 1 },
          { column: "stock", warehouseId: 2 },
        ],
      })
    ).rejects.toThrow("Duplicate column mapping: stock");
  });

  it("rejects a second mapping for the same connection", async () => {
    dataConnectionRepositoryMock.getByIdAndUserId.mockResolvedValue(makeTestedConnection());
    const existing = new Mapping(mockUser, makeTestedConnection(), "Other", "sku", []);
    existing.id = "other";
    repositoryMock.getByConnectionIdAndUserId.mockResolvedValue(existing);

    await expect(
      service.createMapping("user_123", {
        name: "Cromwell",
        connectionId: "c1",
        skuField: "sku",
        stockMappings: [],
      })
    ).rejects.toThrow("Only one mapping can be created per connection");
  });

  describe("updateMapping schedule", () => {
    const makeExistingMapping = (): Mapping => {
      const mapping = new Mapping(mockUser, makeTestedConnection(), "Cromwell", "sku", []);
      mapping.id = "m1";
      return mapping;
    };

    it("validates and persists a daily schedule", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);
      repositoryMock.update.mockResolvedValue(existing);

      await service.updateMapping("m1", "user_123", {
        scheduleEnabled: true,
        schedule: { frequency: "daily", times: [9, 17], daysOfWeek: [1, 2, 3, 4, 5] },
      });

      expect(repositoryMock.update).toHaveBeenCalledWith(
        "m1",
        "user_123",
        expect.objectContaining({
          scheduleEnabled: true,
          schedule: { frequency: "daily", times: [9, 17], daysOfWeek: [1, 2, 3, 4, 5] },
        })
      );
    });

    it("rejects enabling a schedule without a configuration", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      await expect(
        service.updateMapping("m1", "user_123", { scheduleEnabled: true })
      ).rejects.toThrow("Cannot enable a schedule without a schedule configuration");
    });

    it("rejects an unknown schedule frequency", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      await expect(
        service.updateMapping("m1", "user_123", {
          scheduleEnabled: true,
          schedule: { frequency: "yearly" } as any,
        })
      ).rejects.toThrow("Invalid schedule");
    });

    it("rejects a monthly schedule with an invalid day", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      await expect(
        service.updateMapping("m1", "user_123", {
          scheduleEnabled: true,
          schedule: { frequency: "monthly", dayOfMonth: 0, time: 9 },
        })
      ).rejects.toThrow("Invalid schedule");
    });

    it("rejects duplicate hours", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      await expect(
        service.updateMapping("m1", "user_123", {
          scheduleEnabled: true,
          schedule: { frequency: "daily", times: [9, 9] },
        })
      ).rejects.toThrow("Invalid schedule");
    });

    it("validates and persists a once schedule", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);
      repositoryMock.update.mockResolvedValue(existing);

      await service.updateMapping("m1", "user_123", {
        scheduleEnabled: true,
        schedule: { frequency: "once", date: "2026-09-15", time: 14 },
      });

      expect(repositoryMock.update).toHaveBeenCalledWith(
        "m1",
        "user_123",
        expect.objectContaining({
          scheduleEnabled: true,
          schedule: { frequency: "once", date: "2026-09-15", time: 14 },
        })
      );
    });

    it("rejects a once schedule with an invalid date", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      await expect(
        service.updateMapping("m1", "user_123", {
          scheduleEnabled: true,
          schedule: { frequency: "once", date: "not-a-date", time: 14 },
        })
      ).rejects.toThrow("Invalid schedule");
    });

    it("rejects a once schedule with an out-of-range hour", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      await expect(
        service.updateMapping("m1", "user_123", {
          scheduleEnabled: true,
          schedule: { frequency: "once", date: "2026-09-15", time: 25 },
        })
      ).rejects.toThrow("Invalid schedule");
    });

    it("normalizes an empty daysOfWeek to every day", async () => {
      const existing = makeExistingMapping();
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);
      repositoryMock.update.mockResolvedValue(existing);

      await service.updateMapping("m1", "user_123", {
        scheduleEnabled: true,
        schedule: { frequency: "daily", times: [9], daysOfWeek: [] },
      });

      expect(repositoryMock.update).toHaveBeenCalledWith(
        "m1",
        "user_123",
        expect.objectContaining({
          scheduleEnabled: true,
          schedule: { frequency: "daily", times: [9] },
        })
      );
    });
  });

  describe("runMapping", () => {
    it("returns true when the mapping exists", async () => {
      const existing = new Mapping(mockUser, makeTestedConnection(), "Cromwell", "sku", []);
      existing.id = "m1";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      await expect(service.runMapping("m1", "user_123")).resolves.toBe(true);
    });

    it("returns false when the mapping is missing", async () => {
      repositoryMock.getByIdAndUserId.mockResolvedValue(null);

      await expect(service.runMapping("missing", "user_123")).resolves.toBe(false);
    });
  });
});
