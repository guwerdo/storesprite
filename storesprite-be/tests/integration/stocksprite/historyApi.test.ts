import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../../src/app.js";
import { User } from "../../../src/entities/user/User.js";
import { DataConnection } from "../../../src/entities/stocksprite/DataConnection.js";
import { Mapping } from "../../../src/entities/stocksprite/Mapping.js";
import { MappingHistory } from "../../../src/entities/stocksprite/MappingHistory.js";
import { resetTestDatabase } from "../helpers/testDatabase.js";

/**
 * End-to-end history flow against the real test DB:
 * migration applies cleanly, a scheduler dispatch opens a `running` row, the
 * internal progress endpoint persists counters/status, and the user-facing
 * `GET /mappings/:id/history` route returns the DTOs.
 */
describe("History API Integration Tests", () => {
  let app: ReturnType<typeof buildApp>;
  const token = "history_test_token";
  const userId = "mock_jwt_user_history";

  const budapestDate = (d: Date): { date: string; hour: number } => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Budapest",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "00";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour: Number(get("hour")) % 24,
    };
  };

  beforeAll(async () => {
    process.env.INTERNAL_TOKEN = token;
    // Never spawn a real container from the scheduler during tests.
    process.env.INTERNAL_DRIVER = "noop";
    app = buildApp({ logger: false });
    await app.ready();
    await resetTestDatabase(app);
  });

  beforeEach(async () => {
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(MappingHistory, {});
      await em.nativeDelete(Mapping, {});
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
    }
  });

  afterAll(async () => {
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(MappingHistory, {});
      await em.nativeDelete(Mapping, {});
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
    }
    await app.close();
    delete process.env.INTERNAL_TOKEN;
    delete process.env.INTERNAL_DRIVER;
  });

  const seedDueMapping = async (): Promise<string> => {
    const em = app.orm!.em.fork();
    const user = new User(userId, `${userId}@dev.test`, "Mock");
    await em.persistAndFlush(user);
    const connection = new DataConnection(
      user,
      "Cromwell feed",
      "HTTP",
      "CSV",
      { channel: "HTTP", url: "https://example.com/feed.csv" },
      { format: "CSV", delimiter: ";", hasHeaders: true },
      false,
      null,
      { success: true, columns: ["part", "free_stock_hu"] }
    );
    await em.persistAndFlush(connection);

    const mapping = new Mapping(user, connection, "Cromwell", "part", [
      { column: "free_stock_hu", warehouseId: 1 },
    ]);
    mapping.scheduleEnabled = true;
    const { date, hour } = budapestDate(new Date());
    mapping.schedule = { frequency: "once", date, time: hour };
    mapping.lastRunAt = null;
    await em.persistAndFlush(mapping);
    return mapping.id;
  };

  it("returns an empty history for a mapping that never ran", async () => {
    const mappingId = await seedDueMapping();

    const response = await app.inject({
      method: "GET",
      url: `/api/client/stocksprite/mappings/${mappingId}/history`,
      headers: { authorization: `Bearer ${userId}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).history).toEqual([]);
  });

  it("returns 401 for the history route without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/client/stocksprite/mappings/00000000-0000-0000-0000-000000000000/history",
    });

    expect(response.statusCode).toBe(401);
  });

  it("scheduler dispatch opens a running row; finish progress marks it success", async () => {
    const mappingId = await seedDueMapping();

    const dispatch = await app.inject({
      method: "POST",
      url: "/api/internal/stocksprite/scheduler/run",
      headers: { "x-internal-token": token },
    });
    expect(dispatch.statusCode).toBe(200);
    expect(JSON.parse(dispatch.payload).dispatched).toContain(mappingId);

    let history = await app.inject({
      method: "GET",
      url: `/api/client/stocksprite/mappings/${mappingId}/history`,
      headers: { authorization: `Bearer ${userId}` },
    });
    let rows = JSON.parse(history.payload).history;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mappingId,
      status: "running",
      trigger: "schedule",
      processedItems: 0,
    });
    expect(rows[0].finishedAt).toBeNull();
    const runId = rows[0].id;

    // Report parse then a clean finish.
    await app.inject({
      method: "POST",
      url: `/api/internal/stocksprite/mappings/${mappingId}/progress`,
      headers: { "x-internal-token": token },
      payload: { runId, progress: "parse", processedItems: 12 },
    });
    const finish = await app.inject({
      method: "POST",
      url: `/api/internal/stocksprite/mappings/${mappingId}/progress`,
      headers: { "x-internal-token": token },
      payload: { runId, progress: "finish", updatedItems: 10, unchangedItems: 2 },
    });
    expect(finish.statusCode).toBe(204);

    history = await app.inject({
      method: "GET",
      url: `/api/client/stocksprite/mappings/${mappingId}/history`,
      headers: { authorization: `Bearer ${userId}` },
    });
    rows = JSON.parse(history.payload).history;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mappingId,
      status: "success",
      trigger: "schedule",
      processedItems: 12,
      updatedItems: 10,
      unchangedItems: 2,
      warningCount: 0,
      errorCount: 0,
      error: null,
    });
    expect(rows[0].finishedAt).not.toBeNull();
  });

  it("marks the run failed when the container reports an error", async () => {
    const mappingId = await seedDueMapping();

    const dispatch = await app.inject({
      method: "POST",
      url: "/api/internal/stocksprite/scheduler/run",
      headers: { "x-internal-token": token },
    });
    const dispatched = JSON.parse(dispatch.payload).dispatched as string[];
    expect(dispatched).toContain(mappingId);

    const historyBefore = await app.inject({
      method: "GET",
      url: `/api/client/stocksprite/mappings/${mappingId}/history`,
      headers: { authorization: `Bearer ${userId}` },
    });
    const rows = JSON.parse(historyBefore.payload).history as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);

    const error = await app.inject({
      method: "POST",
      url: `/api/internal/stocksprite/mappings/${mappingId}/progress`,
      headers: { "x-internal-token": token },
      payload: { runId: rows[0].id, progress: "error", error: "UNAS blew up" },
    });
    expect(error.statusCode).toBe(204);

    const history = await app.inject({
      method: "GET",
      url: `/api/client/stocksprite/mappings/${mappingId}/history`,
      headers: { authorization: `Bearer ${userId}` },
    });
    const after = JSON.parse(history.payload).history as Array<Record<string, unknown>>;
    expect(after[0]).toMatchObject({
      mappingId,
      status: "failed",
      error: "UNAS blew up",
    });
  });

  it("returns 404 for the history of a mapping owned by another user", async () => {
    const mappingId = await seedDueMapping();

    const response = await app.inject({
      method: "GET",
      url: `/api/client/stocksprite/mappings/${mappingId}/history`,
      headers: { authorization: `Bearer user_other_1` },
    });

    expect(response.statusCode).toBe(404);
  });
});
