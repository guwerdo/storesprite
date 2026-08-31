import type { buildApp } from "../../../src/app.js";

/**
 * Resets the isolated test database to a single source of truth (the migrations)
 * before each integration suite runs. Drops all tables (including the migration
 * history) and re-applies every migration, so entity-based `updateSchema()` and
 * historical migrations never drift apart.
 */
export async function resetTestDatabase(app: ReturnType<typeof buildApp>): Promise<void> {
  if (!app.orm) {
    return;
  }
  const generator = app.orm.getSchemaGenerator();
  await generator.dropSchema({ dropMigrationsTable: true });
  const migrator = app.orm.getMigrator();
  await migrator.up();
}
