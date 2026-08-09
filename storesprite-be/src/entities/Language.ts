import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity({ tableName: "languages" })
export class Language {
  @PrimaryKey({ type: "integer", autoincrement: true })
  id!: number;

  @Property({ type: "varchar", length: 50, unique: true })
  code!: string;

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(code?: string) {
    if (code) {
      this.code = code;
    }
  }
}
