import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import type { IUnasJsonClient } from "@storesprite/unas-json-client";
import { UnasService } from "../../src/services/UnasService.js";
import type { IUnasClientFactory } from "../../src/types/UnasClientFactory.interface.js";
import { makeLoginResponse } from "../helpers/unasFixtures.js";

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

  it("should build the client, call login(true), and return the full login response", async () => {
    // Arrange
    const loginResponse = makeLoginResponse();
    (mockClient.login as any).mockResolvedValue(loginResponse);

    // Act
    const result = await unasService.login(config);

    // Assert
    expect(mockFactory.create).toHaveBeenCalledWith(config);
    expect(mockClient.login).toHaveBeenCalledWith(true);
    expect(result).toEqual(loginResponse);
    expect(mockLogger.info).toHaveBeenCalledWith("UNAS login succeeded", {
      shopId: loginResponse.shopId,
      webshopName: loginResponse.webshopInfo?.webshopName,
    });
  });

  it("should propagate errors thrown by the UNAS client", async () => {
    // Arrange
    (mockClient.login as any).mockRejectedValue(new Error("UNAS is down"));

    // Act & Assert
    await expect(unasService.login(config)).rejects.toThrow("UNAS is down");
  });
});
