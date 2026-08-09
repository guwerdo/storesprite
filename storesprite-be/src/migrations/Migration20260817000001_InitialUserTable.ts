import { Migration } from "@mikro-orm/migrations";

export class Migration20260817000001_InitialUserTable extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "users" (
        "id" varchar(255) not null,
        "email" varchar(255) not null,
        "name" varchar(255) null,
        "created_at" timestamptz not null default CURRENT_TIMESTAMP,
        "updated_at" timestamptz not null default CURRENT_TIMESTAMP,
        constraint "users_pkey" primary key ("id"),
        constraint "users_email_unique" unique ("email")
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "users" cascade;');
  }
}
