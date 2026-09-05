import { Migration } from "@mikro-orm/migrations";

/** Adds the nullable jsonb summary of SKU normalizations surfaced on the finish report. */
export class Migration20260905000013_AddSkuNormalizationsToStockspriteHistory extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "stocksprite_history" ADD COLUMN "sku_normalizations" JSONB NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "stocksprite_history" DROP COLUMN "sku_normalizations";
    `);
  }
}
