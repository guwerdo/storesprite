import type { ILoginResponse } from "@storesprite/unas-json-client";

/**
 * Value stored in `user_settings.unas_connection` — the UNAS login result with
 * the session token redacted.
 */
export interface UnasConnectionRecord extends Omit<ILoginResponse, "token"> {
  /** Always null — the session token is stripped before persisting. */
  token: null;
  /** ISO-8601 timestamp of when this login result was saved. */
  checkedAt: string;
}
