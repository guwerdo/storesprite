import { describe, it, expect, beforeEach, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { EntityManager } from "@mikro-orm/postgresql";
import { UserRepository } from "../../../../src/repositories/user/UserRepository.js";
import { User } from "../../../../src/entities/user/User.js";

describe("UserRepository", () => {
  let mockEm: EntityManager;
  let repo: UserRepository;

  beforeEach(() => {
    mockEm = mock<EntityManager>();
    repo = new UserRepository(mockEm);
  });

  describe("getById", () => {
    it("should return user when found", async () => {
      // Arrange
      const existingUser = new User("user_123", "test@example.com", "Test User");
      mockEm.findOne.mockResolvedValue(existingUser as any);

      // Act
      const result = await repo.getById("user_123");

      // Assert
      expect(mockEm.findOne).toHaveBeenCalledWith(User, { id: "user_123" });
      expect(result).toEqual(existingUser);
    });

    it("should return null when user not found", async () => {
      // Arrange
      mockEm.findOne.mockResolvedValue(null as any);

      // Act
      const result = await repo.getById("user_unknown");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getByEmail", () => {
    it("should find user by email", async () => {
      // Arrange
      const existingUser = new User("user_123", "test@example.com", "Test User");
      mockEm.findOne.mockResolvedValue(existingUser as any);

      // Act
      const result = await repo.getByEmail("test@example.com");

      // Assert
      expect(mockEm.findOne).toHaveBeenCalledWith(User, { email: "test@example.com" });
      expect(result).toEqual(existingUser);
    });
  });

  describe("add", () => {
    it("should persist and flush a new user if not already existing", async () => {
      // Arrange
      mockEm.findOne.mockResolvedValue(null as any);
      mockEm.persistAndFlush.mockResolvedValue(undefined as any);

      // Act
      const result = await repo.add({
        id: "user_new",
        email: "new@example.com",
        name: "New Person",
      });

      // Assert
      expect(mockEm.findOne).toHaveBeenCalledWith(User, { id: "user_new" });
      expect(mockEm.persistAndFlush).toHaveBeenCalled();
      expect(result.id).toBe("user_new");
      expect(result.email).toBe("new@example.com");
      expect(result.name).toBe("New Person");
    });

    it("should update existing user and flush if already exists", async () => {
      // Arrange
      const existing = new User("user_existing", "old@example.com", "Old Name");
      mockEm.findOne.mockResolvedValue(existing as any);
      mockEm.flush.mockResolvedValue(undefined as any);

      // Act
      const result = await repo.add({
        id: "user_existing",
        email: "updated@example.com",
        name: "Updated Name",
      });

      // Assert
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result.email).toBe("updated@example.com");
      expect(result.name).toBe("Updated Name");
    });
  });

  describe("update", () => {
    it("should update user fields and flush", async () => {
      // Arrange
      const existing = new User("user_123", "test@example.com", "Old Name");
      mockEm.findOne.mockResolvedValue(existing as any);
      mockEm.flush.mockResolvedValue(undefined as any);

      // Act
      const result = await repo.update("user_123", { name: "Brand New Name" });

      // Assert
      expect(result?.name).toBe("Brand New Name");
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it("should return null if user does not exist", async () => {
      // Arrange
      mockEm.findOne.mockResolvedValue(null as any);

      // Act
      const result = await repo.update("non_existent", { name: "Name" });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should remove and flush if user exists", async () => {
      // Arrange
      const existing = new User("user_123", "test@example.com");
      mockEm.findOne.mockResolvedValue(existing as any);
      mockEm.removeAndFlush.mockResolvedValue(undefined as any);

      // Act
      const success = await repo.delete("user_123");

      // Assert
      expect(mockEm.removeAndFlush).toHaveBeenCalledWith(existing);
      expect(success).toBe(true);
    });

    it("should return false if user does not exist", async () => {
      // Arrange
      mockEm.findOne.mockResolvedValue(null as any);

      // Act
      const success = await repo.delete("non_existent");

      // Assert
      expect(success).toBe(false);
    });
  });
});
