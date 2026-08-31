import { Options, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { User } from "../entities/user/User.js";
import { Language } from "../entities/user/Language.js";
import { UserSetting } from "../entities/user/UserSetting.js";
import { DataConnection } from "../entities/stocksprite/DataConnection.js";
import { Mapping } from "../entities/stocksprite/Mapping.js";
import dotenv from "dotenv";

dotenv.config();

const clientUrl =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || "storesprite"}:${process.env.PGPASSWORD || "storesprite_secure_pass"}@${process.env.PGHOST || "postgres"}:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE || "storesprite_db"}`;

const config: Options = {
  driver: PostgreSqlDriver,
  clientUrl,
  entities: [User, Language, UserSetting, DataConnection, Mapping],
  extensions: [Migrator],
  migrations: {
    path: "./src/migrations",
    pathTs: "./src/migrations",
    glob: "!(*.d).{js,ts}",
    transactional: true,
    allOrNothing: true,
  },
  debug: process.env.NODE_ENV === "development",
};

export default config;
