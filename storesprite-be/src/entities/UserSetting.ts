import { Entity, ManyToOne, OneToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { User } from "./User.js";
import { Language } from "./Language.js";

@Entity({ tableName: "user_settings" })
export class UserSetting {
  @PrimaryKey({ type: "integer", autoincrement: true })
  id!: number;

  @OneToOne(() => User, { owner: true, unique: true, deleteRule: "cascade" })
  user!: User;

  @Property({ type: "varchar", length: 255, nullable: true })
  unasApiKey?: string | null;

  @Property({ type: "varchar", length: 255, nullable: true, default: "https://api.unas.eu/shop/" })
  unasApiEndpoint?: string | null = "https://api.unas.eu/shop/";

  @ManyToOne(() => Language, { nullable: true, deleteRule: "set null" })
  language?: Language | null;

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(user: User, unasApiKey?: string | null, language?: Language | null, unasApiEndpoint?: string | null) {
    this.user = user;
    this.unasApiKey = unasApiKey;
    this.language = language;
    if (unasApiEndpoint !== undefined) {
      this.unasApiEndpoint = unasApiEndpoint;
    }
  }
}
