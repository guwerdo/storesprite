import { Entity, ManyToOne, OneToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { User } from "./User.js";
import { Language } from "./Language.js";
import type { UnasConnectionRecord } from "../types/UnasConnection.interface.js";
import { DEFAULT_UNAS_API_ENDPOINT } from "../config/unas.constants.js";

@Entity({ tableName: "user_settings" })
export class UserSetting {
  @PrimaryKey({ type: "integer", autoincrement: true })
  id!: number;

  @OneToOne(() => User, { owner: true, unique: true, deleteRule: "cascade" })
  user!: User;

  @Property({ type: "varchar", length: 255, nullable: true })
  unasApiKey?: string | null;

  @Property({ type: "varchar", length: 255, nullable: true, default: DEFAULT_UNAS_API_ENDPOINT })
  unasApiEndpoint?: string | null = DEFAULT_UNAS_API_ENDPOINT;

  @ManyToOne(() => Language, { nullable: true, deleteRule: "set null" })
  language?: Language | null;

  @Property({ type: "jsonb", nullable: true })
  unasConnection?: UnasConnectionRecord | null;

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(
    user: User,
    unasApiKey?: string | null,
    language?: Language | null,
    unasApiEndpoint?: string | null,
    unasConnection?: UnasConnectionRecord | null
  ) {
    this.user = user;
    this.unasApiKey = unasApiKey;
    this.language = language;
    if (unasApiEndpoint !== undefined) {
      this.unasApiEndpoint = unasApiEndpoint;
    }
    this.unasConnection = unasConnection ?? null;
  }
}
