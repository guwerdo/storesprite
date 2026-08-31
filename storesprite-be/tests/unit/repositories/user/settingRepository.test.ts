import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { EntityManager } from "@mikro-orm/postgresql";
import { SettingRepository } from "../../../../src/repositories/user/SettingRepository.js";
import { User } from "../../../../src/entities/user/User.js";
import { Language } from "../../../../src/entities/user/Language.js";
import { UserSetting } from "../../../../src/entities/user/UserSetting.js";
import { makeUnasConnectionRecord } from "../../helpers/unasFixtures.js";

describe("SettingRepository", () => {
  let mockEm: EntityManager;
  let repo: SettingRepository;

  beforeEach(() => {
    mockEm = mock<EntityManager>();
    repo = new SettingRepository(mockEm);
  });

  describe("getByUserId", () => {
    it("should find user setting by user ID with populated relations", async () => {
      // Arrange
      const user = new User("user_abc", "user@example.com");
      const setting = new UserSetting(user, "api_key_val");
      mockEm.findOne.mockResolvedValue(setting as any);

      // Act
      const result = await repo.getByUserId("user_abc");

      // Assert
      expect(mockEm.findOne).toHaveBeenCalledWith(
        UserSetting,
        { user: { id: "user_abc" } },
        { populate: ["language"] }
      );
      expect(result).toBe(setting);
    });
  });

  describe("getLanguages", () => {
    it("should fetch all languages ordered by ID", async () => {
      // Arrange
      const languages = [new Language("en-us"), new Language("hu")];
      mockEm.find.mockResolvedValue(languages as any);

      // Act
      const result = await repo.getLanguages();

      // Assert
      expect(mockEm.find).toHaveBeenCalledWith(Language, {}, { orderBy: { id: "ASC" } });
      expect(result).toEqual(languages);
    });
  });

  describe("upsert", () => {
    it("should update existing user settings", async () => {
      // Arrange
      const user = new User("user_abc", "user@example.com");
      const existing = new UserSetting(user, "old_key");
      const lang = new Language("hu");
      lang.id = 2;

      // Mock getByUserId (first call to findOne for UserSetting)
      mockEm.findOne
        .mockResolvedValueOnce(existing as any) // getByUserId
        .mockResolvedValueOnce(lang as any); // find Language

      // Act
      const result = await repo.upsert("user_abc", {
        unasApiKey: "new_key",
        unasApiEndpoint: "https://api.unas.eu/shop/",
        languageId: 2,
      });

      // Assert
      expect(existing.unasApiKey).toBe("new_key");
      expect(existing.unasApiEndpoint).toBe("https://api.unas.eu/shop/");
      expect(existing.language).toBe(lang);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it("should create and persist new user settings if not existing", async () => {
      // Arrange
      const user = new User("user_new", "new@example.com");
      const lang = new Language("en-us");
      lang.id = 1;

      mockEm.findOne
        .mockResolvedValueOnce(null as any) // getByUserId (no existing setting)
        .mockResolvedValueOnce(lang as any) // find Language
        .mockResolvedValueOnce(user as any); // find User

      // Act
      const result = await repo.upsert("user_new", {
        unasApiKey: "first_key",
        unasApiEndpoint: "https://api.unas.eu/shop/",
        languageId: 1,
      });

      // Assert
      expect(mockEm.persistAndFlush).toHaveBeenCalled();
      expect(result.user).toBe(user);
      expect(result.unasApiKey).toBe("first_key");
      expect(result.unasApiEndpoint).toBe("https://api.unas.eu/shop/");
      expect(result.language).toBe(lang);
    });
  });

  describe("setUnasConnection", () => {
    it("should set the connection and flush when a setting exists", async () => {
      // Arrange
      const user = new User("user_abc", "user@example.com");
      const setting = new UserSetting(user, "api_key");
      const connection = makeUnasConnectionRecord();
      mockEm.findOne.mockResolvedValue(setting as any);

      // Act
      await repo.setUnasConnection("user_abc", connection as any);

      // Assert
      expect(mockEm.findOne).toHaveBeenCalledWith(UserSetting, { user: { id: "user_abc" } });
      expect(setting.unasConnection).toBe(connection);
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it("should no-op when no setting exists", async () => {
      // Arrange
      mockEm.findOne.mockResolvedValue(null as any);

      // Act
      await repo.setUnasConnection("user_404", null);

      // Assert
      expect(mockEm.flush).not.toHaveBeenCalled();
    });
  });
});
