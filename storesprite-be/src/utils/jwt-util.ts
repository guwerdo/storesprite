export interface ClerkSessionClaims {
  sub: string;
  email?: string;
  email_address?: string;
  name?: string;
  first_name?: string;
}

export function decodeJwtPayload(token: string): ClerkSessionClaims | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  // 1. If standard 3-part JWT structure
  const parts = token.split(".");
  if (parts.length >= 2) {
    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonStr = Buffer.from(base64, "base64").toString("utf-8");
      const parsed = JSON.parse(jsonStr) as ClerkSessionClaims;
      if (parsed && typeof parsed === "object" && parsed.sub) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  // 2. Fallback for test/dev tokens
  return {
    sub: token,
    email: `${token}@dev.test`,
    name: token,
  };
}
