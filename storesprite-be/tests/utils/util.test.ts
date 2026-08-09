import { describe, it, expect } from "vitest";
import { Util } from "../../src/utils/index.js";

describe("Backend Util Module", () => {
  describe("stringifyError", () => {
    it("should extract error stack or message from an Error instance", () => {
      const error = new Error("Custom error message");
      const result = Util.stringifyError(error);
      expect(result).toContain("Custom error message");
    });

    it("should return string as is when input is a string", () => {
      const result = Util.stringifyError("raw string error");
      expect(result).toBe("raw string error");
    });

    it("should stringify object errors", () => {
      const result = Util.stringifyError({ status: 500, detail: "failed" });
      expect(result).toBe('{"status":500,"detail":"failed"}');
    });
  });

  describe("decodeJwtPayload", () => {
    it("should decode valid JWT payload", () => {
      // payload = { "sub": "user_123", "email": "test@example.com" }
      const token = "header.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.signature";
      const claims = Util.decodeJwtPayload(token);
      expect(claims).toEqual({
        sub: "user_123",
        email: "test@example.com",
      });
    });

    it("should return null for malformed tokens", () => {
      expect(Util.decodeJwtPayload("invalid-token")).toBeNull();
      expect(Util.decodeJwtPayload("")).toBeNull();
    });
  });
});
