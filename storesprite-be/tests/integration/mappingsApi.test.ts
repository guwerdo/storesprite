import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/entities/User.js";
import { DataConnection } from "../../src/entities/DataConnection.js";
import { Mapping } from "../../src/entities/Mapping.js";
import { resetTestDatabase } from "../helpers/testDatabase.js";

describe("Mappings API Integration Tests", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    await resetTestDatabase(app);
  });

  beforeEach(async () => {
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(Mapping, {});
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
    }
  });

  afterAll(async () => {
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(Mapping, {});
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
    }
    await app.close();
  });

  const seedTestedConnection = async (userId: string): Promise<string> => {
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
      { success: true, columns: ["part", "free_stock_hu", "free_stock_cz"] }
    );
    await em.persistAndFlush(connection);
    return connection.id;
  };

  it("should return 401 when Bearer token is missing", async () => {
    const response = await app.inject({ method: "GET", url: "/api/client/stocksprite/mappings" });
    expect(response.statusCode).toBe(401);
  });

  it("GET /stocksprite/mappings/rules returns the rule dictionary", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/client/stocksprite/mappings/rules",
      headers: { authorization: "Bearer mock_jwt_user_map" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules.find((r: { op: string }) => r.op === "multiply")).toBeDefined();
    expect(body.rules.find((r: { op: string }) => r.op === "replace-all")).toBeDefined();
  });

  it("creates, fetches and deletes a mapping with rules", async () => {
    const connectionId = await seedTestedConnection("mock_jwt_user_map");

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/client/stocksprite/mappings",
      headers: { authorization: "Bearer mock_jwt_user_map" },
      payload: {
        name: "Cromwell",
        connectionId,
        skuField: "part",
        skuRules: [{ op: "replace-all", params: { from: " ", to: "_" } }],
        stockMappings: [
          { column: "free_stock_hu", warehouseId: 1, rules: [{ op: "multiply", params: { value: 3 } }] },
          { column: "free_stock_cz", warehouseId: 5726549 },
        ],
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const createBody = JSON.parse(createResponse.payload);
    expect(createBody.success).toBe(true);
    expect(createBody.mapping.id).toBeDefined();
    expect(createBody.mapping.skuField).toBe("part");
    expect(createBody.mapping.stockMappings).toHaveLength(2);

    const mappingId = createBody.mapping.id;

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/client/stocksprite/mappings/${mappingId}`,
      headers: { authorization: "Bearer mock_jwt_user_map" },
    });
    expect(getResponse.statusCode).toBe(200);
    expect(JSON.parse(getResponse.payload).mapping.id).toBe(mappingId);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/client/stocksprite/mappings/${mappingId}`,
      headers: { authorization: "Bearer mock_jwt_user_map" },
    });
    expect(deleteResponse.statusCode).toBe(200);
  });

  it("rejects a mapping for an untested connection", async () => {
    const em = app.orm!.em.fork();
    const user = new User("mock_jwt_user_map", "mock_jwt_user_map@dev.test", "Mock");
    await em.persistAndFlush(user);
    const connection = new DataConnection(
      user,
      "Untested",
      "HTTP",
      "CSV",
      { channel: "HTTP", url: "https://example.com/feed.csv" },
      { format: "CSV", delimiter: ";" },
      false,
      null,
      null
    );
    await em.persistAndFlush(connection);

    const response = await app.inject({
      method: "POST",
      url: "/api/client/stocksprite/mappings",
      headers: { authorization: "Bearer mock_jwt_user_map" },
      payload: { name: "X", connectionId: connection.id, skuField: "sku", stockMappings: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload).error).toContain("must be tested");
  });

  it("rejects a second mapping for the same connection", async () => {
    const connectionId = await seedTestedConnection("mock_jwt_user_map");
    const payload = { name: "First", connectionId, skuField: "part", stockMappings: [] };

    const first = await app.inject({
      method: "POST",
      url: "/api/client/stocksprite/mappings",
      headers: { authorization: "Bearer mock_jwt_user_map" },
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/client/stocksprite/mappings",
      headers: { authorization: "Bearer mock_jwt_user_map" },
      payload: { ...payload, name: "Second" },
    });
    expect(second.statusCode).toBe(400);
    expect(JSON.parse(second.payload).error).toContain("Only one mapping");
  });

  it("sets a schedule on a mapping and runs it", async () => {
    const connectionId = await seedTestedConnection("mock_jwt_user_map");
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/client/stocksprite/mappings",
      headers: { authorization: "Bearer mock_jwt_user_map" },
      payload: { name: "Scheduled", connectionId, skuField: "part", stockMappings: [] },
    });
    expect(createResponse.statusCode).toBe(201);
    const mappingId = JSON.parse(createResponse.payload).mapping.id;

    const schedule = { frequency: "daily", times: [9, 17], daysOfWeek: [1, 2, 3, 4, 5] };
    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/client/stocksprite/mappings/${mappingId}`,
      headers: { authorization: "Bearer mock_jwt_user_map" },
      payload: { scheduleEnabled: true, schedule },
    });
    expect(updateResponse.statusCode).toBe(200);
    const updateBody = JSON.parse(updateResponse.payload);
    expect(updateBody.mapping.scheduleEnabled).toBe(true);
    expect(updateBody.mapping.schedule).toEqual(schedule);

    const runResponse = await app.inject({
      method: "POST",
      url: `/api/client/stocksprite/mappings/${mappingId}/run`,
      headers: { authorization: "Bearer mock_jwt_user_map" },
    });
    expect(runResponse.statusCode).toBe(202);
  });

  it("returns 404 when running a missing mapping", async () => {
    const runResponse = await app.inject({
      method: "POST",
      url: "/api/client/stocksprite/mappings/00000000-0000-0000-0000-000000000000/run",
      headers: { authorization: "Bearer mock_jwt_user_map" },
    });
    expect(runResponse.statusCode).toBe(404);
  });
});
