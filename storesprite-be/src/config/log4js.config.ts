import type { Configuration } from "log4js";

export const log4jsConfig: Configuration = {
  appenders: {
    console: {
      type: "stdout",
      layout: {
        type: "json-with-data-field",
      },
    },
  },
  categories: {
    default: { appenders: ["console"], level: process.env.LOG_LEVEL || "info" },
    be: { appenders: ["console"], level: process.env.LOG_LEVEL || "info" },
  },
};
