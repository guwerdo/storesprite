import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { SettingService } from "../../src/services/SettingService.js";
import { ISettingRepository } from "../../src/types/SettingRepository.interface.js";
import { Language } from "../../src/entities/Language.js";
import { UserSetting } from "../../src/entities/UserSetting.js";
import { User } from "../../src/entities/User.js";

describe("SettingService", () => {
  let mockSettingRepo: ISettingRepository;
  let mockLogger: Logger;
  let settingService: SettingService;

  beforeEach(() => {
    mockSettingRepo = mock<ISettingRepository>();
    mockLogger = mock<Logger>();
    settingService = new SettingService(mockSettingRepo, mockLogger);
  });

  describe("getUserSettings", () => {
    it("should return mapped user settings when settings exist", async () => {
      // Arrange
      const user = new User("user_123", "test@example.com");
      const language = new Language("hu");
      language.id = 2;
      const setting = new UserSetting(user, "unas_secret_key_123", language, "https://api.unas.eu/shop/");
      (mockSettingRepo.getByUserId as any).mockResolvedValue(setting);

      // Act
      const result = await settingService.getUserSettings("user_123");

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith("Fetching user settings in service", { userId: "user_123" });
      expect(result).toEqual({
        unasApiKey: "unas_secret_key_123",
        unasApiEndpoint: "https://api.unas.eu/shop/",
        languageId: 2,
        unasConnection: null,
      });
    });

    it("should return null when no settings exist", async () => {
      // Arrange
      (mockSettingRepo.getByUserId as any).mockResolvedValue(null);

      // Act
      const result = await settingService.getUserSettings("user_404");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("saveUnasConnection", () => {
    it("should delegate the connection to the repository", async () => {
      // Arrange
      const connection = {
        token: null,
        expire: "2026.08.24 11:23:00",
        expireTime: 1724752800,
        shopId: 83219,
        subscription: "vip-100000",
        permissions: ["getProduct"],
        status: "ok",
        checkedAt: "2026-08-24T00:00:00.000Z",
      };

      // Act
      await settingService.saveUnasConnection("user_123", connection as any);

      // Assert
      expect(mockSettingRepo.setUnasConnection).toHaveBeenCalledWith("user_123", connection);
    });

    it("should delegate a null connection to reset", async () => {
      // Act
      await settingService.saveUnasConnection("user_123", null);

      // Assert
      expect(mockSettingRepo.setUnasConnection).toHaveBeenCalledWith("user_123", null);
    });
  });

  describe("saveUserSettings", () => {
    it("should call repository upsert and return updated setting", async () => {
      // Arrange
      const user = new User("user_123", "test@example.com");
      const language = new Language("en-us");
      language.id = 1;
      const savedSetting = new UserSetting(user, "my_api_key", language, "https://custom.unas.endpoint/shop/");
      (mockSettingRepo.upsert as any).mockResolvedValue(savedSetting);

      // Act
      const result = await settingService.saveUserSettings("user_123", {
        unasApiKey: "my_api_key",
        unasApiEndpoint: "https://custom.unas.endpoint/shop/",
        languageId: 1,
      });

      // Assert
      expect(mockSettingRepo.upsert).toHaveBeenCalledWith("user_123", {
        unasApiKey: "my_api_key",
        unasApiEndpoint: "https://custom.unas.endpoint/shop/",
        languageId: 1,
      });
      expect(result).toBe(savedSetting);
    });
  });

  describe("getAvailableLanguages", () => {
    it("should return languages list from repository", async () => {
      // Arrange
      const lang1 = new Language("en-us");
      lang1.id = 1;
      const lang2 = new Language("hu");
      lang2.id = 2;
      (mockSettingRepo.getLanguages as any).mockResolvedValue([lang1, lang2]);

      // Act
      const result = await settingService.getAvailableLanguages();

      // Assert
      expect(result).toEqual([lang1, lang2]);
    });
  });
});
