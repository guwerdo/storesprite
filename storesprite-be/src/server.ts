import "reflect-metadata";
import dotenv from "dotenv";
import { buildApp } from "./app.js";

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const app = buildApp({
  logger: true,
});

const start = async () => {
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
