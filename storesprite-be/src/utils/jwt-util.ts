export interface ClerkSessionClaims {
  sub: string;
  email?: string;
  email_address?: string;
  name?: string;
  first_name?: string;
}

export function decodeJwtPayload(token: string): ClerkSessionClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonStr = Buffer.from(base64, "base64").toString("utf-8");
      return JSON.parse(jsonStr) as ClerkSessionClaims;
    }
  } catch {
    // fallback if unparseable
  }
  return null;
}
