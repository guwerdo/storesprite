import { Migration } from "@mikro-orm/migrations";

export class Migration20260830000010_AddScheduleEnabledIndexAndCheck extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_mappings_user_schedule_enabled" ON "mappings"("user_id", "schedule_enabled");
    `);
    this.addSql(`
      ALTER TABLE "mappings" ADD CONSTRAINT "mappings_schedule_enabled_requires_schedule"
      CHECK ("schedule_enabled" = false OR "schedule" IS NOT NULL);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP INDEX IF EXISTS "idx_mappings_user_schedule_enabled";
    `);
    this.addSql(`
      ALTER TABLE "mappings" DROP CONSTRAINT IF EXISTS "mappings_schedule_enabled_requires_schedule";
    `);
  }
}
