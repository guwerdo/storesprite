import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { TYPES, IUserRepository, User as UserType } from "../../src/di/index.js";
import { Webhook } from "svix";

describe("Clerk Webhooks Integration Tests", () => {
  let app: ReturnType<typeof buildApp>;
  const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const originalSecret = process.env.CLERK_WEBHOOK_SECRET;

  const mockUserRepo: IUserRepository = {
    getById: vi.fn(),
    getByEmail: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    process.env.CLERK_WEBHOOK_SECRET = secret;
    vi.clearAllMocks();

    app = buildApp({ logger: false });

    // Ensure container has mock repo bound for test isolation
    await app.ready();
    app.container.rebind(TYPES.IUserRepository).toConstantValue(mockUserRepo);
  });

  afterEach(async () => {
    process.env.CLERK_WEBHOOK_SECRET = originalSecret;
    await app.close();
  });

  function createSignedHeaders(payload: string) {
    const wh = new Webhook(secret);
    const timestamp = new Date();
    const svixId = "msg_test_12345";
    const signature = wh.sign(svixId, timestamp, payload);

    return {
      "svix-id": svixId,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature,
    };
  }

  it("should return 400 if Svix headers are missing", async () => {
    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/clerk/webhooks/clerk",
      payload: { type: "user.created" },
    });

    // Assert
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: "Missing Svix headers" });
  });

  it("should return 400 if signature verification fails", async () => {
    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/clerk/webhooks/clerk",
      headers: {
        "svix-id": "invalid_id",
        "svix-timestamp": "123456",
        "svix-signature": "v1,invalid_signature",
      },
      payload: { type: "user.created" },
    });

    // Assert
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: "Webhook verification failed" });
  });

  it("should handle user.created and call IUserRepository.add", async () => {
    // Arrange
    const eventPayload = {
      type: "user.created",
      data: {
        id: "user_clerk_123",
        email_addresses: [{ email_address: "jane.doe@example.com" }],
        first_name: "Jane",
        last_name: "Doe",
      },
    };
    const rawBody = JSON.stringify(eventPayload);
    const headers = createSignedHeaders(rawBody);

    (mockUserRepo.add as any).mockResolvedValue({
      id: "user_clerk_123",
      email: "jane.doe@example.com",
      name: "Jane Doe",
    } as UserType);

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/clerk/webhooks/clerk",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      payload: rawBody,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(mockUserRepo.add).toHaveBeenCalledWith({
      id: "user_clerk_123",
      email: "jane.doe@example.com",
      name: "Jane Doe",
    });
  });

  it("should handle user.updated and call IUserRepository.update", async () => {
    // Arrange
    const eventPayload = {
      type: "user.updated",
      data: {
        id: "user_clerk_123",
        email_addresses: [{ email_address: "jane.updated@example.com" }],
        first_name: "Jane",
        last_name: "Smith",
      },
    };
    const rawBody = JSON.stringify(eventPayload);
    const headers = createSignedHeaders(rawBody);

    (mockUserRepo.update as any).mockResolvedValue({
      id: "user_clerk_123",
      email: "jane.updated@example.com",
      name: "Jane Smith",
    } as UserType);

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/clerk/webhooks/clerk",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      payload: rawBody,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(mockUserRepo.update).toHaveBeenCalledWith("user_clerk_123", {
      email: "jane.updated@example.com",
      name: "Jane Smith",
    });
  });

  it("should handle user.deleted and call IUserRepository.delete", async () => {
    // Arrange
    const eventPayload = {
      type: "user.deleted",
      data: {
        id: "user_clerk_123",
        deleted: true,
      },
    };
    const rawBody = JSON.stringify(eventPayload);
    const headers = createSignedHeaders(rawBody);

    (mockUserRepo.delete as any).mockResolvedValue(true);

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/clerk/webhooks/clerk",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      payload: rawBody,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(mockUserRepo.delete).toHaveBeenCalledWith("user_clerk_123");
  });
});
