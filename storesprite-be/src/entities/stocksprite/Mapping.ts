import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { User } from "../User.js";
import { DataConnection } from "./DataConnection.js";
import type {
  MappingRule,
  StockMappingItem,
  MappingSchedule,
} from "../../types/stocksprite/MappingRepository.interface.js";

@Entity({ tableName: "mappings" })
export class Mapping {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @ManyToOne(() => User, { deleteRule: "cascade" })
  user!: User;

  @ManyToOne(() => DataConnection, { deleteRule: "cascade" })
  connection!: DataConnection;

  @Property({ type: "varchar", length: 255 })
  name!: string;

  @Property({ type: "boolean", default: false })
  scheduleEnabled = false;

  @Property({ type: "jsonb", nullable: true })
  schedule?: MappingSchedule | null;

  @Property({ type: "varchar", length: 255 })
  skuField!: string;

  @Property({ type: "jsonb", nullable: true })
  skuRules?: MappingRule[] | null;

  @Property({ type: "jsonb" })
  stockMappings!: StockMappingItem[];

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(
    user: User,
    connection: DataConnection,
    name: string,
    skuField: string,
    stockMappings: StockMappingItem[],
    skuRules?: MappingRule[] | null
  ) {
    this.user = user;
    this.connection = connection;
    this.name = name;
    this.skuField = skuField;
    this.stockMappings = stockMappings;
    this.skuRules = skuRules ?? null;
  }
}
