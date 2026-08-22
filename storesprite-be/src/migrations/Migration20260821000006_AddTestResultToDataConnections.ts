import { Migration } from "@mikro-orm/migrations";

export class Migration20260821000006_AddTestResultToDataConnections extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "data_connections"
      ADD COLUMN IF NOT EXISTS "test_result" JSONB NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "data_connections"
      DROP COLUMN IF EXISTS "test_result";
    `);
  }
}
