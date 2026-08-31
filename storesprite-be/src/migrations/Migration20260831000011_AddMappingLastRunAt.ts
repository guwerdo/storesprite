import { Migration } from "@mikro-orm/migrations";

export class Migration20260831000011_AddMappingLastRunAt extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE "mappings" ADD COLUMN IF NOT EXISTS "last_run_at" TIMESTAMPTZ NULL;`);
  }

  async down(): Promise<void> {
    this.addSql(`ALTER TABLE "mappings" DROP COLUMN IF EXISTS "last_run_at";`);
  }
}
