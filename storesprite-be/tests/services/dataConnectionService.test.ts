import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { DataConnectionService } from "../../src/services/DataConnectionService.js";
import {
  IDataConnectionRepository,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
} from "../../src/types/DataConnectionRepository.interface.js";
import { DataConnection } from "../../src/entities/DataConnection.js";
import { User } from "../../src/entities/User.js";
import { JsonSchemaValidator } from "../../src/utils/JsonSchemaValidator.js";

describe("DataConnectionService Unit Tests", () => {
  let repositoryMock: ReturnType<typeof mock<IDataConnectionRepository>>;
  let service: DataConnectionService;
  const mockUser = new User("user_123", "test@storesprite.com", "Test User");

  beforeEach(() => {
    repositoryMock = mock<IDataConnectionRepository>();
    service = new DataConnectionService(repositoryMock, new JsonSchemaValidator());
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

  describe("getConnectionById", () => {
    it("should return mapped DTO when connection exists", async () => {
      // Arrange
      const conn = new DataConnection(
        mockUser,
        "Magictools HTTP",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        true,
        { authType: "NONE" }
      );
      conn.id = "conn-uuid-1";
      repositoryMock.getByIdAndUserId.mockResolvedValue(conn);

      // Act
      const result = await service.getConnectionById("conn-uuid-1", "user_123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("conn-uuid-1");
      expect(result?.name).toBe("Magictools HTTP");
      expect(result?.credentials).toEqual({ authType: "NONE" });
    });

    it("should return null when connection does not exist", async () => {
      // Arrange
      repositoryMock.getByIdAndUserId.mockResolvedValue(null);

      // Act
      const result = await service.getConnectionById("non-existent", "user_123");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("createConnection validation & credentials", () => {
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

    it("should reject connection when name exceeds 255 characters", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "a".repeat(256),
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "https://example.com/feed.csv" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Connection name cannot exceed 255 characters");
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
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Invalid HTTP connection config");
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
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Invalid SFTP connection config");
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
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Invalid CSV format config");
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
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Invalid XML format config");
    });

    it("should successfully create connection with HTTP Bearer credentials", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Magictools Feed",
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "https://media.magictools.hu/shared/products.csv", insecureIgnoreSsl: true },
        dataFormatConfig: { format: "CSV", delimiter: ";", hasHeaders: true },
        credentials: { authType: "BEARER", token: "my-jwt-token" },
      };

      const createdConn = new DataConnection(
        mockUser,
        "Magictools Feed",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://media.magictools.hu/shared/products.csv", method: "GET", insecureIgnoreSsl: true },
        { format: "CSV", delimiter: ";", encoding: "UTF-8", hasHeaders: true },
        true,
        { authType: "BEARER", token: "my-jwt-token" }
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
      expect(result.credentials).toEqual({ authType: "BEARER", token: "my-jwt-token" });
    });

    it("should successfully create connection with HTTP API Key credentials", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "API Key Feed",
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "https://example.com/feed.csv" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
        credentials: { authType: "API_KEY", headerName: "X-Api-Key", headerValue: "secret-key-123" },
      };

      const createdConn = new DataConnection(
        mockUser,
        "API Key Feed",
        "HTTP",
        "CSV",
        dto.config,
        dto.dataFormatConfig,
        true,
        dto.credentials
      );
      createdConn.id = "conn-apikey";
      repositoryMock.create.mockResolvedValue(createdConn);

      // Act
      const result = await service.createConnection("user_123", dto);

      // Assert
      expect(result.id).toBe("conn-apikey");
      expect(result.credentials).toEqual({ authType: "API_KEY", headerName: "X-Api-Key", headerValue: "secret-key-123" });
    });

    it("should successfully create connection with SFTP Password credentials", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "SFTP Pass Feed",
        channel: "SFTP",
        dataFormat: "XML",
        config: { channel: "SFTP", host: "sftp.dunitker.hu", port: 22, remoteDir: "/export" },
        dataFormatConfig: { format: "XML", rowPath: ".//item" },
        credentials: { authType: "PASSWORD", username: "dunitker_user", password: "dunitker_password" },
      };

      const createdConn = new DataConnection(
        mockUser,
        "SFTP Pass Feed",
        "SFTP",
        "XML",
        dto.config,
        dto.dataFormatConfig,
        true,
        dto.credentials
      );
      createdConn.id = "conn-sftp-pass";
      repositoryMock.create.mockResolvedValue(createdConn);

      // Act
      const result = await service.createConnection("user_123", dto);

      // Assert
      expect(result.id).toBe("conn-sftp-pass");
      expect(result.credentials).toEqual({ authType: "PASSWORD", username: "dunitker_user", password: "dunitker_password" });
    });

    it("should reject HTTP connection when credentials schema is invalid", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Invalid HTTP Credentials",
        channel: "HTTP",
        dataFormat: "CSV",
        config: { channel: "HTTP", url: "https://example.com/data.csv" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
        credentials: { authType: "BASIC", username: "only-username" } as unknown as CreateDataConnectionDto["credentials"],
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Invalid HTTP credentials");
    });

    it("should reject SFTP connection when credentials schema is invalid", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "Invalid SFTP Credentials",
        channel: "SFTP",
        dataFormat: "CSV",
        config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/stock" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
        credentials: { authType: "PRIVATE_KEY", username: "user-only" } as unknown as CreateDataConnectionDto["credentials"],
      };

      // Act & Assert
      await expect(service.createConnection("user_123", dto)).rejects.toThrow("Invalid SFTP credentials");
    });

    it("should successfully accept valid SFTP Private Key credentials", async () => {
      // Arrange
      const dto: CreateDataConnectionDto = {
        name: "SFTP Key Connection",
        channel: "SFTP",
        dataFormat: "CSV",
        config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/stock" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
        credentials: {
          authType: "PRIVATE_KEY",
          username: "keyuser",
          privateKey: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----",
          passphrase: "secret-passphrase",
        },
      };

      const createdConn = new DataConnection(
        mockUser,
        "SFTP Key Connection",
        "SFTP",
        "CSV",
        dto.config,
        dto.dataFormatConfig,
        true,
        dto.credentials
      );
      createdConn.id = "conn-sftp-key";
      repositoryMock.create.mockResolvedValue(createdConn);

      // Act
      const result = await service.createConnection("user_123", dto);

      // Assert
      expect(result.id).toBe("conn-sftp-key");
      expect(result.channel).toBe("SFTP");
      expect(result.credentials).toEqual(dto.credentials);
    });
  });

  describe("updateConnection", () => {
    it("should return null if existing connection is not found", async () => {
      // Arrange
      repositoryMock.getByIdAndUserId.mockResolvedValue(null);

      // Act
      const result = await service.updateConnection("non-existent-id", "user_123", { name: "New Name" });

      // Assert
      expect(result).toBeNull();
    });

    it("should update connection name and credentials partially", async () => {
      // Arrange
      const existing = new DataConnection(
        mockUser,
        "Old Name",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        true,
        { authType: "NONE" }
      );
      existing.id = "conn-to-update";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      const updatedConn = new DataConnection(
        mockUser,
        "New Name",
        "HTTP",
        "CSV",
        existing.config,
        existing.dataFormatConfig,
        true,
        { authType: "BEARER", token: "updated-token" }
      );
      updatedConn.id = "conn-to-update";
      repositoryMock.update.mockResolvedValue(updatedConn);

      const dto: UpdateDataConnectionDto = {
        name: "New Name",
        credentials: { authType: "BEARER", token: "updated-token" },
      };

      // Act
      const result = await service.updateConnection("conn-to-update", "user_123", dto);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.name).toBe("New Name");
      expect(result?.credentials).toEqual({ authType: "BEARER", token: "updated-token" });
    });

    it("should validate and switch channel from HTTP to SFTP during update", async () => {
      // Arrange
      const existing = new DataConnection(
        mockUser,
        "Switch Channel",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        true,
        { authType: "NONE" }
      );
      existing.id = "conn-switch";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      const updatedConn = new DataConnection(
        mockUser,
        "Switch Channel",
        "SFTP",
        "CSV",
        { channel: "SFTP", host: "sftp.newhost.com", remoteDir: "/feeds" },
        { format: "CSV", delimiter: ";" },
        true,
        { authType: "PASSWORD", username: "sftpuser", password: "secretpassword" }
      );
      updatedConn.id = "conn-switch";
      repositoryMock.update.mockResolvedValue(updatedConn);

      const dto: UpdateDataConnectionDto = {
        channel: "SFTP",
        config: { channel: "SFTP", host: "sftp.newhost.com", remoteDir: "/feeds" },
        credentials: { authType: "PASSWORD", username: "sftpuser", password: "secretpassword" },
      };

      // Act
      const result = await service.updateConnection("conn-switch", "user_123", dto);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.channel).toBe("SFTP");
      expect(result?.credentials).toEqual({ authType: "PASSWORD", username: "sftpuser", password: "secretpassword" });
    });

    it("should reject update when new name is empty", async () => {
      // Arrange
      const existing = new DataConnection(
        mockUser,
        "Valid Name",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" }
      );
      existing.id = "conn-1";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      // Act & Assert
      await expect(service.updateConnection("conn-1", "user_123", { name: "  " })).rejects.toThrow("Connection name is required");
    });

    it("should throw 409 Conflict if update is attempted while test is in progress", async () => {
      // Arrange
      const existing = new DataConnection(
        mockUser,
        "Testing Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        false,
        null,
        { progress: "download", started_at: new Date().toISOString() }
      );
      existing.id = "conn-testing";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      // Act & Assert
      await expect(
        service.updateConnection("conn-testing", "user_123", { name: "Updated Name" })
      ).rejects.toThrow("Cannot update connection while testing is in progress");
    });

    it("should reset testResult and isActive when config or channel is edited", async () => {
      // Arrange
      const existing = new DataConnection(
        mockUser,
        "Old Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed1.csv" },
        { format: "CSV", delimiter: ";" },
        true,
        null,
        { progress: "finish", success: true }
      );
      existing.id = "conn-edited";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      const updatedConn = new DataConnection(
        mockUser,
        "Old Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed2.csv" },
        { format: "CSV", delimiter: ";" },
        false,
        null,
        null
      );
      updatedConn.id = "conn-edited";
      repositoryMock.update.mockResolvedValue(updatedConn);

      // Act
      const result = await service.updateConnection("conn-edited", "user_123", {
        config: { channel: "HTTP", url: "https://example.com/feed2.csv" },
      });

      // Assert
      expect(result?.isActive).toBe(false);
      expect(result?.testResult).toBeNull();
      expect(repositoryMock.update).toHaveBeenCalledWith(
        "conn-edited",
        "user_123",
        expect.objectContaining({
          isActive: false,
          testResult: null,
        })
      );
    });

    it("should reject activating a connection without a successful test result", async () => {
      // Arrange
      const existing = new DataConnection(
        mockUser,
        "Untested Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        false,
        null,
        null
      );
      existing.id = "conn-untested";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      // Act & Assert
      await expect(
        service.updateConnection("conn-untested", "user_123", { isActive: true })
      ).rejects.toThrow("Connection cannot be activated until it was tested successfully");
    });
  });

  describe("invalidateConnection", () => {
    it("should set isActive false and testResult null", async () => {
      // Arrange
      const existing = new DataConnection(
        mockUser,
        "Active Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        true,
        null,
        { progress: "finish", success: true }
      );
      existing.id = "conn-inval";
      repositoryMock.getByIdAndUserId.mockResolvedValue(existing);

      // Act
      const result = await service.invalidateConnection("conn-inval", "user_123");

      // Assert
      expect(result).toBe(true);
      expect(repositoryMock.update).toHaveBeenCalledWith("conn-inval", "user_123", {
        isActive: false,
        testResult: null,
      });
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

  describe("saveTestResult", () => {
    it("should merge, validate, and persist a partial test result", async () => {
      // Arrange
      const conn = new DataConnection(
        mockUser,
        "Test Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        false,
        null,
        { progress: "start" }
      );
      conn.id = "conn-test";
      repositoryMock.getById.mockResolvedValue(conn);

      const updatedConn = new DataConnection(
        mockUser,
        "Test Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" },
        false,
        null,
        { progress: "finish", success: true }
      );
      updatedConn.id = "conn-test";
      repositoryMock.update.mockResolvedValue(updatedConn);

      // Act
      const result = await service.saveTestResult("conn-test", { progress: "finish", success: true });

      // Assert
      expect(repositoryMock.getById).toHaveBeenCalledWith("conn-test");
      expect(repositoryMock.update).toHaveBeenCalledWith(
        "conn-test",
        "user_123",
        expect.objectContaining({
          testResult: expect.objectContaining({ progress: "finish", success: true }),
        })
      );
      expect(result?.testResult).toEqual(expect.objectContaining({ progress: "finish", success: true }));
    });

    it("should return null when the connection is not found", async () => {
      // Arrange
      repositoryMock.getById.mockResolvedValue(null);

      // Act
      const result = await service.saveTestResult("missing", { progress: "start" });

      // Assert
      expect(result).toBeNull();
      expect(repositoryMock.update).not.toHaveBeenCalled();
    });
  });

  describe("getConnectionByIdForWorker", () => {
    it("should fetch by id and map to DTO", async () => {
      // Arrange
      const conn = new DataConnection(
        mockUser,
        "Worker Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" }
      );
      conn.id = "conn-worker";
      repositoryMock.getById.mockResolvedValue(conn);

      // Act
      const result = await service.getConnectionByIdForWorker("conn-worker");

      // Assert
      expect(repositoryMock.getById).toHaveBeenCalledWith("conn-worker");
      expect(result?.id).toBe("conn-worker");
      expect(result?.name).toBe("Worker Conn");
    });

    it("should return null when the connection is not found", async () => {
      // Arrange
      repositoryMock.getById.mockResolvedValue(null);

      // Act
      const result = await service.getConnectionByIdForWorker("missing");

      // Assert
      expect(result).toBeNull();
    });
  });
});
