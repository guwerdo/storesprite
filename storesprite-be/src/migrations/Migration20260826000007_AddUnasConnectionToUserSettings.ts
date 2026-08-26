import { Migration } from "@mikro-orm/migrations";

export class Migration20260826000007_AddUnasConnectionToUserSettings extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "user_settings"
      ADD COLUMN IF NOT EXISTS "unas_connection" JSONB NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "user_settings"
      DROP COLUMN IF EXISTS "unas_connection";
    `);
  }
}
