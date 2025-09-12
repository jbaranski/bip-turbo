import type { Logger } from "@bip/domain";
import pino from "pino";

/**
 * Creates a logger instance for use in test scripts and CLI tools
 */
export const createTestLogger = (): Logger => {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "HH:MM:ss",
      },
    },
  });
};

export const testLogger = createTestLogger();