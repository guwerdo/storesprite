import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import type { IUnasJsonClient } from "@storesprite/unas-json-client";
import { UnasService } from "../../src/services/UnasService.js";
import type { IUnasClientFactory } from "../../src/types/UnasClientFactory.interface.js";
import { makeLoginResponse, makeWebshopInfo } from "../helpers/unasFixtures.js";

describe("UnasService", () => {
  let mockFactory: IUnasClientFactory;
  let mockClient: IUnasJsonClient;
  let mockLogger: Logger;
  let unasService: UnasService;

  const config = {
    baseUrl: "https://api.unas.eu/shop/",
    apiKey: "test-key",
  };

  beforeEach(() => {
    mockFactory = mock<IUnasClientFactory>();
    mockClient = mock<IUnasJsonClient>();
    mockLogger = mock<Logger>();
    unasService = new UnasService(mockFactory, mockLogger);
    (mockFactory.create as any).mockReturnValue(mockClient);
  });

  it("should build the client, call login(true), and return webshop info", async () => {
    // Arrange
    const webshopInfo = makeWebshopInfo();
    (mockClient.login as any).mockResolvedValue(makeLoginResponse({ webshopInfo }));

    // Act
    const result = await unasService.getWebshopInfo(config);

    // Assert
    expect(mockFactory.create).toHaveBeenCalledWith(config);
    expect(mockClient.login).toHaveBeenCalledWith(true);
    expect(result).toEqual(webshopInfo);
    expect(mockLogger.info).toHaveBeenCalledWith("UNAS webshop info retrieved", {
      shopId: 83219,
      webshopName: webshopInfo.webshopName,
    });
  });

  it("should propagate errors thrown by the UNAS client", async () => {
    // Arrange
    (mockClient.login as any).mockRejectedValue(new Error("UNAS is down"));

    // Act & Assert
    await expect(unasService.getWebshopInfo(config)).rejects.toThrow("UNAS is down");
  });

  it("should throw when the login response has no webshop info", async () => {
    // Arrange
    (mockClient.login as any).mockResolvedValue(makeLoginResponse({ webshopInfo: undefined }));

    // Act & Assert
    await expect(unasService.getWebshopInfo(config)).rejects.toThrow(
      "UNAS login response did not include webshop info"
    );
  });
});
