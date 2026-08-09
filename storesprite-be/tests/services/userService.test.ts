import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { UserService } from "../../src/services/UserService.js";
import { IUserRepository, User } from "../../src/di/index.js";

describe("UserService with Injected Logger", () => {
  let mockUserRepo: IUserRepository;
  let mockLogger: Logger;
  let userService: UserService;

  beforeEach(() => {
    mockUserRepo = mock<IUserRepository>();
    mockLogger = mock<Logger>();
    userService = new UserService(mockUserRepo, mockLogger);
  });

  it("should fetch user by id and log info event", async () => {
    // Arrange
    const sampleUser = new User("user_abc", "abc@example.com", "ABC");
    (mockUserRepo.getById as any).mockResolvedValue(sampleUser);

    // Act
    const result = await userService.getUserById("user_abc");

    // Assert
    expect(mockLogger.info).toHaveBeenCalledWith("Fetching user by id", { userId: "user_abc" });
    expect(result).toBe(sampleUser);
  });

  it("should create user and log info event", async () => {
    // Arrange
    const newUser = new User("user_new", "new@example.com", "Newbie");
    (mockUserRepo.add as any).mockResolvedValue(newUser);

    // Act
    const result = await userService.createUser("user_new", "new@example.com", "Newbie");

    // Assert
    expect(mockLogger.info).toHaveBeenCalledWith("Creating user", {
      userId: "user_new",
      email: "new@example.com",
      name: "Newbie",
    });
    expect(result).toBe(newUser);
  });
});
