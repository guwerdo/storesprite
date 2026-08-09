import { Migration } from "@mikro-orm/migrations";

export class Migration20260818000003_StandardizeLanguageCodes extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      UPDATE "languages"
      SET "code" = 'en', "updated_at" = CURRENT_TIMESTAMP
      WHERE lower("code") = 'en-us' OR lower("code") = 'en_us';
    `);

    this.addSql(`
      INSERT INTO "languages" ("code")
      VALUES ('en'), ('hu')
      ON CONFLICT ("code") DO NOTHING;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      UPDATE "languages"
      SET "code" = 'en-us', "updated_at" = CURRENT_TIMESTAMP
      WHERE "code" = 'en';
    `);
  }
}
