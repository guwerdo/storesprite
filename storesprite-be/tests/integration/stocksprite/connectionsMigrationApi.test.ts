import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../../src/app.js";
import { User } from "../../../src/entities/user/User.js";
import { DataConnection } from "../../../src/entities/stocksprite/DataConnection.js";
import { resetTestDatabase } from "../../helpers/testDatabase.js";

describe("Migration & Data Connections Integration Tests", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    await resetTestDatabase(app);
  });

  beforeEach(async () => {
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
      await em.flush();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("MikroORM Migration Verification", () => {
    it("should have data_connections table and check constraints created by migration", async () => {
      if (!app.orm) return;

      const em = app.orm.em.fork();
      const knex = em.getKnex();

      // Verify table exists
      const tableExists = await knex.schema.hasTable("data_connections");
      expect(tableExists).toBe(true);

      // Verify columns
      const hasColumnName = await knex.schema.hasColumn("data_connections", "name");
      const hasColumnChannel = await knex.schema.hasColumn("data_connections", "channel");
      const hasColumnDataFormat = await knex.schema.hasColumn("data_connections", "data_format");
      const hasColumnConfig = await knex.schema.hasColumn("data_connections", "config");
      const hasColumnDataFormatConfig = await knex.schema.hasColumn("data_connections", "data_format_config");

      expect(hasColumnName).toBe(true);
      expect(hasColumnChannel).toBe(true);
      expect(hasColumnDataFormat).toBe(true);
      expect(hasColumnConfig).toBe(true);
      expect(hasColumnDataFormatConfig).toBe(true);
    });
  });

  describe("Live Database REST CRUD Operations (/api/client/stocksprite/connections)", () => {
    it("should create HTTP connection, persist in DB, and retrieve via GET", async () => {
      // 1. Create HTTP / CSV connection
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/client/stocksprite/connections",
        headers: {
          authorization: "Bearer live_test_jwt_1",
        },
        payload: {
          name: "Magictools Supplier Feed",
          channel: "HTTP",
          dataFormat: "CSV",
          config: {
            channel: "HTTP",
            url: "https://media.magictools.hu/shared/products.csv",
            method: "GET",
            insecureIgnoreSsl: true,
            timeoutSeconds: 30,
          },
          dataFormatConfig: {
            format: "CSV",
            delimiter: ";",
            encoding: "UTF-8",
            hasHeaders: true,
          },
          isActive: true,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.payload);
      expect(createBody.success).toBe(true);
      expect(createBody.connection.name).toBe("Magictools Supplier Feed");
      const connId = createBody.connection.id;

      // 2. Query direct from DB via MikroORM to verify physical database persistence
      if (app.orm) {
        const em = app.orm.em.fork();
        const dbConn = await em.findOne(DataConnection, { id: connId }, { populate: ["user"] });
        expect(dbConn).not.toBeNull();
        expect(dbConn?.name).toBe("Magictools Supplier Feed");
        expect(dbConn?.channel).toBe("HTTP");
        expect(dbConn?.dataFormat).toBe("CSV");
        expect(dbConn?.user.id).toBe("live_test_jwt_1");
      }

      // 3. Retrieve list from REST endpoint
      const listResponse = await app.inject({
        method: "GET",
        url: "/api/client/stocksprite/connections",
        headers: {
          authorization: "Bearer live_test_jwt_1",
        },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.payload);
      expect(listBody.connections).toHaveLength(1);
      expect(listBody.connections[0].id).toBe(connId);

      // 4. Update connection
      const updateResponse = await app.inject({
        method: "PUT",
        url: `/api/client/stocksprite/connections/${connId}`,
        headers: {
          authorization: "Bearer live_test_jwt_1",
        },
        payload: {
          name: "Magictools Feed (Renamed)",
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updateBody = JSON.parse(updateResponse.payload);
      expect(updateBody.connection.name).toBe("Magictools Feed (Renamed)");

      // 5. Delete connection
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/client/stocksprite/connections/${connId}`,
        headers: {
          authorization: "Bearer live_test_jwt_1",
        },
      });

      expect(deleteResponse.statusCode).toBe(200);

      // 6. Verify table is empty
      const verifyListResponse = await app.inject({
        method: "GET",
        url: "/api/client/stocksprite/connections",
        headers: {
          authorization: "Bearer live_test_jwt_1",
        },
      });

      expect(verifyListResponse.statusCode).toBe(200);
      expect(JSON.parse(verifyListResponse.payload).connections).toHaveLength(0);
    });
  });
});
