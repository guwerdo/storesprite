import { Migration } from "@mikro-orm/migrations";

export class Migration20260817000002_AddLanguagesAndUserSettings extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "languages" (
        "id" serial not null,
        "code" varchar(50) not null,
        "created_at" timestamptz not null default CURRENT_TIMESTAMP,
        "updated_at" timestamptz not null default CURRENT_TIMESTAMP,
        constraint "languages_pkey" primary key ("id"),
        constraint "languages_code_unique" unique ("code")
      );
    `);

    this.addSql(`
      insert into "languages" ("code")
      values ('en'), ('hu')
      on conflict ("code") do nothing;
    `);

    this.addSql(`
      create table if not exists "user_settings" (
        "id" serial not null,
        "user_id" varchar(255) not null,
        "unas_api_key" varchar(255) null,
        "language_id" int null,
        "created_at" timestamptz not null default CURRENT_TIMESTAMP,
        "updated_at" timestamptz not null default CURRENT_TIMESTAMP,
        constraint "user_settings_pkey" primary key ("id"),
        constraint "user_settings_user_id_unique" unique ("user_id"),
        constraint "user_settings_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade,
        constraint "user_settings_language_id_foreign" foreign key ("language_id") references "languages" ("id") on update cascade on delete set null
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "user_settings" cascade;');
    this.addSql('drop table if exists "languages" cascade;');
  }
}
