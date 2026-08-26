/**
 * Narrow view of the backend `UnasConnectionRecord` returned by
 * `POST /api/client/unas/login` and `GET /api/client/settings`.
 *
 * Only the fields the UI renders are declared (ISP) — the full record also
 * carries `token`, `expire`, `shopId`, `subscription`, `status`, and the
 * complete `webshopInfo` tree, which the presentation layer does not consume.
 */
export interface IUnasConnection {
  checkedAt: string;
  permissions: string[];
  webshopInfo?: { webshopName: string };
}

export interface IUnasLoginResponse {
  connection: IUnasConnection;
}
