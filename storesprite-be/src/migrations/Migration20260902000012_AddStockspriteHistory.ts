import { Migration } from "@mikro-orm/migrations";

export class Migration20260902000012_AddStockspriteHistory extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "stocksprite_history" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "mapping_id" UUID NOT NULL REFERENCES "mappings"("id") ON DELETE CASCADE,
        "status" VARCHAR(20) NOT NULL DEFAULT 'running',
        "trigger" VARCHAR(20) NOT NULL DEFAULT 'schedule',
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "finished_at" TIMESTAMPTZ NULL,
        "processed_items" INTEGER NOT NULL DEFAULT 0,
        "updated_items" INTEGER NOT NULL DEFAULT 0,
        "unchanged_items" INTEGER NOT NULL DEFAULT 0,
        "warning_count" INTEGER NOT NULL DEFAULT 0,
        "error_count" INTEGER NOT NULL DEFAULT 0,
        "error" TEXT NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_stocksprite_history_mapping_started"
        ON "stocksprite_history"("mapping_id", "started_at" DESC);
    `);

    this.addSql(`
      ALTER TABLE "stocksprite_history"
        ADD CONSTRAINT "chk_stocksprite_history_status"
        CHECK ("status" IN ('running','success','partial','failed'));
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP TABLE IF EXISTS "stocksprite_history" CASCADE;
    `);
  }
}
