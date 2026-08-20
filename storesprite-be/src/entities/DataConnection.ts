import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { User } from "./User.js";

export type DataConnectionChannel = "HTTP" | "SFTP";
export type DataConnectionFormat = "CSV" | "XML";

@Entity({ tableName: "data_connections" })
export class DataConnection {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @ManyToOne(() => User, { deleteRule: "cascade" })
  user!: User;

  @Property({ type: "varchar", length: 255 })
  name!: string;

  @Property({ type: "varchar", length: 50 })
  channel!: DataConnectionChannel;

  @Property({ type: "varchar", length: 20 })
  dataFormat!: DataConnectionFormat;

  @Property({ type: "jsonb" })
  dataFormatConfig!: Record<string, unknown>;

  @Property({ type: "boolean", default: true })
  isActive = true;

  @Property({ type: "jsonb" })
  config!: Record<string, unknown>;

  @Property({ type: "jsonb", nullable: true })
  credentials?: Record<string, unknown> | null;

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(
    user: User,
    name: string,
    channel: DataConnectionChannel,
    dataFormat: DataConnectionFormat,
    config: Record<string, unknown>,
    dataFormatConfig: Record<string, unknown>,
    isActive = true,
    credentials?: Record<string, unknown> | null
  ) {
    this.user = user;
    this.name = name;
    this.channel = channel;
    this.dataFormat = dataFormat;
    this.config = config;
    this.dataFormatConfig = dataFormatConfig;
    this.isActive = isActive;
    this.credentials = credentials ?? null;
  }
}
