import { injectable } from "inversify";
import {
  createUnasJsonClient,
  type IUnasJsonClient,
  type IUnasJsonClientConfig,
} from "@storesprite/unas-json-client";
import type { IUnasClientFactory } from "../types/UnasClientFactory.interface.js";

/**
 * Builds an UNAS JSON client per request.
 *
 * Uses the SDK's `createUnasJsonClient` facade, which spins up a throwaway
 * Inversify v7 container internally. This is deliberate: the SDK ships
 * Inversify ^7 while `storesprite-be` (and `storesprite-fe`) still run
 * Inversify ^6, so passing the backend's v6 container into
 * `registerUnasJsonClient` would risk resolving v7-decorated classes across the
 * version boundary.
 *
 * TODO(storesprite): Once `storesprite-be` and `storesprite-fe` are upgraded to
 * Inversify v7, switch this to `registerUnasJsonClient(container, config)` bound
 * against the backend's own container and drop the facade.
 */
@injectable()
export class UnasClientFactory implements IUnasClientFactory {
  public create(config: IUnasJsonClientConfig): IUnasJsonClient {
    return createUnasJsonClient(config);
  }
}
