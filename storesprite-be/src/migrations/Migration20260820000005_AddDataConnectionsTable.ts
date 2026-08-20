import { Migration } from "@mikro-orm/migrations";

export class Migration20260820000005_AddDataConnectionsTable extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "data_connections" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" VARCHAR(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" VARCHAR(255) NOT NULL,
        "channel" VARCHAR(50) NOT NULL,
        "data_format" VARCHAR(20) NOT NULL,
        "data_format_config" JSONB NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "config" JSONB NOT NULL,
        "credentials" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_data_connections_channel" CHECK ("channel" IN ('HTTP', 'SFTP')),
        CONSTRAINT "chk_data_connections_data_format" CHECK ("data_format" IN ('CSV', 'XML'))
      );
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_data_connections_user_id" ON "data_connections"("user_id");
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_data_connections_user_active" ON "data_connections"("user_id", "is_active");
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP TABLE IF EXISTS "data_connections" CASCADE;
    `);
  }
}
