import { Migration } from "@mikro-orm/migrations";

export class Migration20260818000004_AddUnasApiEndpointToUserSettings extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table if exists "user_settings"
      add column if not exists "unas_api_endpoint" varchar(255) null default 'https://api.unas.eu/shop/';
    `);

    this.addSql(`
      update "user_settings"
      set "unas_api_endpoint" = 'https://api.unas.eu/shop/'
      where "unas_api_endpoint" is null;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      alter table if exists "user_settings"
      drop column if exists "unas_api_endpoint";
    `);
  }
}
