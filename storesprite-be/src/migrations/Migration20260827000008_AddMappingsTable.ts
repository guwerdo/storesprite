import { Migration } from "@mikro-orm/migrations";

export class Migration20260827000008_AddMappingsTable extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "mappings" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" VARCHAR(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "connection_id" UUID NOT NULL REFERENCES "data_connections"("id") ON DELETE CASCADE,
        "name" VARCHAR(255) NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT false,
        "sku_field" VARCHAR(255) NOT NULL,
        "sku_rules" JSONB NULL,
        "stock_mappings" JSONB NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_mappings_user_id" ON "mappings"("user_id");
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_mappings_user_enabled" ON "mappings"("user_id", "enabled");
    `);

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_mappings_user_connection" ON "mappings"("user_id", "connection_id");
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP TABLE IF EXISTS "mappings" CASCADE;
    `);
  }
}
