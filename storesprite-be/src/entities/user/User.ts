import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity({ tableName: "users" })
export class User {
  @PrimaryKey({ type: "varchar", length: 255 })
  id!: string;

  @Property({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Property({ type: "varchar", length: 255, nullable: true })
  name?: string;

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(id: string, email: string, name?: string) {
    this.id = id;
    this.email = email;
    this.name = name;
  }
}
