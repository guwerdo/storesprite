import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { MappingService } from "../../src/services/MappingService.js";
import { IMappingRepository } from "../../src/types/MappingRepository.interface.js";
import { IDataConnectionRepository } from "../../src/types/DataConnectionRepository.interface.js";
import { DataConnection } from "../../src/entities/DataConnection.js";
import { User } from "../../src/entities/User.js";
import { Mapping } from "../../src/entities/Mapping.js";
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
});
