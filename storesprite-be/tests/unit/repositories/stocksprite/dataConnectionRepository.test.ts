import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { EntityManager } from "@mikro-orm/postgresql";
import { DataConnectionRepository } from "../../../../src/repositories/stocksprite/DataConnectionRepository.js";
import { DataConnection } from "../../../../src/entities/stocksprite/DataConnection.js";
import { User } from "../../../../src/entities/user/User.js";

describe("DataConnectionRepository", () => {
  let mockEm: EntityManager;
  let repo: DataConnectionRepository;

  beforeEach(() => {
    mockEm = mock<EntityManager>();
    repo = new DataConnectionRepository(mockEm);
  });

  describe("getById", () => {
    it("should find a data connection by id", async () => {
      // Arrange
      const user = new User("user_1", "user@example.com");
      const conn = new DataConnection(
        user,
        "Feed Conn",
        "HTTP",
        "CSV",
        { channel: "HTTP", url: "https://example.com/feed.csv" },
        { format: "CSV", delimiter: ";" }
      );
      conn.id = "conn-1";
      mockEm.findOne.mockResolvedValue(conn as any);

      // Act
      const result = await repo.getById("conn-1");

      // Assert
      expect(mockEm.findOne).toHaveBeenCalledWith(DataConnection, { id: "conn-1" });
      expect(result).toBe(conn);
    });

    it("should return null when no connection matches the id", async () => {
      // Arrange
      mockEm.findOne.mockResolvedValue(null as any);

      // Act
      const result = await repo.getById("missing");

      // Assert
      expect(result).toBeNull();
    });
  });
});
