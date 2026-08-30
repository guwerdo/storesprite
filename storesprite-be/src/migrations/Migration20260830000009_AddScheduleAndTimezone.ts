import { Migration } from "@mikro-orm/migrations";

export class Migration20260830000009_AddScheduleAndTimezone extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "mappings" ADD COLUMN IF NOT EXISTS "schedule_enabled" BOOLEAN NOT NULL DEFAULT false;
    `);
    this.addSql(`
      ALTER TABLE "mappings" ADD COLUMN IF NOT EXISTS "schedule" JSONB NULL;
    `);
    this.addSql(`
      ALTER TABLE "mappings" DROP COLUMN IF EXISTS "enabled";
    `);
    this.addSql(`
      DROP INDEX IF EXISTS "idx_mappings_user_enabled";
    `);
    this.addSql(`
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(64) NULL DEFAULT 'Europe/Budapest';
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "mappings" DROP COLUMN IF EXISTS "schedule_enabled";
    `);
    this.addSql(`
      ALTER TABLE "mappings" DROP COLUMN IF EXISTS "schedule";
    `);
    this.addSql(`
      ALTER TABLE "mappings" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT false;
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_mappings_user_enabled" ON "mappings"("user_id", "enabled");
    `);
    this.addSql(`
      ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "timezone";
    `);
  }
}
