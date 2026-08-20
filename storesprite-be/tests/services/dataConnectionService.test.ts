import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { DataConnectionService } from "../../src/services/DataConnectionService.js";
import {
  IDataConnectionRepository,
  CreateDataConnectionDto,
} from "../../src/types/DataConnectionRepository.interface.js";
import { DataConnection } from "../../src/entities/DataConnection.js";
import { User } from "../../src/entities/User.js";

describe("DataConnectionService Unit Tests", () => {
  let repositoryMock: ReturnType<typeof mock<IDataConnectionRepository>>;
  let service: DataConnectionService;
  const mockUser = new User("user_123", "test@storesprite.com", "Test User");

  beforeEach(() => {
    repositoryMock = mock<IDataConnectionRepository>();
    service = new DataConnectionService(repositoryMock);
  });

  describe("getConnections", () => {
    it("should return mapped DTOs for existing connections", async () => {
      // Arrange
      const conn = new DataConnection(
        mockUser,
        "Cromwell SFTP",
        "SFTP",
        "CSV",
        { channel: "SFTP", host: "sftp.cromwell.co.uk", port: 22, remoteDir: "/" },
        { format: "CSV", delimiter: ",", encoding: "UTF-8", hasHeaders: true },
        true
      );
      conn.id = "mock-uuid-1";
      repositoryMock.getAllByUserId.mockResolvedValue([conn]);

      // Act
      const result = await service.getConnections("user_123");

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("mock-uuid-1");
      expect(result[0].name).toBe("Cromwell SFTP");
      expect(result[0].channel).toBe("SFTP");
      expect(result[0].dataFormat).toBe("CSV");
      expect(result[0].isActive).toBe(true);
    });
  });

  describe("createConnection validation", () => {
    it("should reject connection when name is missing or empty", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "",
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "https://example.com/feed.csv" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Connection name is required");
    });

    it("should reject HTTP connection with invalid URL", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Invalid HTTP",
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "not-a-valid-url" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("HTTP connection 'url' must be a valid URL");
    });

    it("should reject SFTP connection when host is missing", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Invalid SFTP",
        channel: "SFTP",
        dataFormat: "CSV",
        config: { channel: "SFTP", host: "", remoteDir: "/feeds" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("SFTP connection requires a non-empty 'host'");
    });

    it("should reject CSV format when delimiter is missing", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Invalid CSV",
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "https://example.com/data.csv" },
        dataFormatConfig: { format: "CSV", delimiter: "" },
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("CSV data format requires a non-empty 'delimiter'");
    });

    it("should reject XML format when rowPath is missing", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Invalid XML",
        channel: "HTTP",
        dataFormat: "XML",
        config: { channel: "HTTP", url: "https://example.com/data.xml" },
        dataFormatConfig: { format: "XML", rowPath: "" },
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("XML data format requires a non-empty 'rowPath'");
    });

    it("should successfully create and return DTO when all fields are valid", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Magictools Feed",
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "https://media.magictools.hu/shared/products.csv", insecureIgnoreSsl: true },
        dataFormatConfig: { format: "CSV", delimiter: ";", hasHeaders: true },
      };

      const createdConn = new DataConnection(
        mockUser,
        "Magictools Feed",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://media.magictools.hu/shared/products.csv", method: "GET", insecureIgnoreSsl: true },
        { format: "CSV", delimiter: ";", encoding: "UTF-8", hasHeaders: true },
        true
      );
      createdConn.id = "conn-uuid-magic";
      repositoryMock.create.mockResolvedValue(createdConn);

      // Act
      const result = await service.createConnection("user_123", dto);

      // Assert
      expect(result.id).toBe("conn-uuid-magic");
      expect(result.name).toBe("Magictools Feed");
      expect(result.channel).toBe("HTTP");
      expect(result.dataFormat).toBe("CSV");
    });
  });

  describe("deleteConnection", () => {
    it("should call repository delete and return status", async () => {
      // Arrange
      repositoryMock.delete.mockResolvedValue(true);

      // Act
      const result = await service.deleteConnection("conn-123", "user_123");

      // Assert
      expect(result).toBe(true);
      expect(repositoryMock.delete).toHaveBeenCalledWith("conn-123", "user_123");
    });
  });
});
