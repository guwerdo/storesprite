import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { UnasConfigError, UnasHttpError, UnasTransportError, type IUnasJsonClient } from "@storesprite/unas-json-client";
import { UnasService } from "../../src/services/UnasService.js";
import type { ISettingService } from "../../src/types/SettingService.interface.js";
import type { IUnasClientFactory } from "../../src/types/UnasClientFactory.interface.js";
import { makeLoginResponse, makeWebshopInfo } from "../helpers/unasFixtures.js";

describe("UnasService", () => {
  let mockSettingService: ISettingService;
  let mockFactory: IUnasClientFactory;
  let mockClient: IUnasJsonClient;
  let mockLogger: Logger;
  let unasService: UnasService;

  const userId = "user_123";
  const settings = {
    unasApiKey: "test-key",
    unasApiEndpoint: "https://api.unas.eu/shop/",
  };

  beforeEach(() => {
    mockSettingService = mock<ISettingService>();
    mockFactory = mock<IUnasClientFactory>();
    mockClient = mock<IUnasJsonClient>();
    mockLogger = mock<Logger>();
    unasService = new UnasService(mockSettingService, mockFactory, mockLogger);
    (mockFactory.create as any).mockReturnValue(mockClient);
    (mockSettingService.getUserSettings as any).mockResolvedValue(settings);
  });

  it("should fetch settings, login, redact the token, persist, and return webshop info", async () => {
    // Arrange
    const webshopInfo = makeWebshopInfo();
    (mockClient.login as any).mockResolvedValue(makeLoginResponse({ webshopInfo }));

    // Act
    const result = await unasService.login(userId);

    // Assert
    expect(mockSettingService.getUserSettings).toHaveBeenCalledWith(userId);
    expect(mockClient.login).toHaveBeenCalledWith(true);
    expect(mockSettingService.saveUnasConnection).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        token: null,
        checkedAt: expect.any(String),
        shopId: 83219,
        webshopInfo,
      })
    );
    expect(result).toEqual(webshopInfo);
  });

  it("should throw UnasConfigError when the user has no API key configured", async () => {
    // Arrange
    (mockSettingService.getUserSettings as any).mockResolvedValue(null);

    // Act & Assert
    await expect(unasService.login(userId)).rejects.toThrow(UnasConfigError);
  });

  it("should reset the connection and rethrow on a non-2xx UNAS response", async () => {
    // Arrange
    (mockClient.login as any).mockRejectedValue(
      new UnasHttpError("invalid ApiKey", 400, "https://api.unas.eu/shop/login")
    );

    // Act & Assert
    await expect(unasService.login(userId)).rejects.toThrow(UnasHttpError);
    expect(mockSettingService.saveUnasConnection).toHaveBeenCalledWith(userId, null);
  });

  it("should NOT reset the connection on a network error", async () => {
    // Arrange
    (mockClient.login as any).mockRejectedValue(new UnasTransportError("network timeout"));

    // Act & Assert
    await expect(unasService.login(userId)).rejects.toThrow(UnasTransportError);
    expect(mockSettingService.saveUnasConnection).not.toHaveBeenCalled();
  });
});
