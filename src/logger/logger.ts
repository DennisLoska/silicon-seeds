import {
  configure,
  getConsoleSink,
  type Logger as LoggerType,
} from "@logtape/logtape";
import { getLogger } from "@logtape/logtape";
import { prettyFormatter } from "@logtape/pretty";

export namespace Logger {
  let logger: LoggerType;

  export async function init() {
    await configure({
      sinks: { console: getConsoleSink({ formatter: prettyFormatter }) },
      loggers: [
        { category: ["logtape", "meta"], sinks: [] },
        { category: "app", lowestLevel: "debug", sinks: ["console"] },
      ],
    });
    logger = getLogger("app");
  }

  type LogLevel = "info" | "warn" | "error" | "debug";

  function log_handler(level: LogLevel, message: string, value?: unknown) {
    if (value !== undefined) {
      logger[level](`${message}\n\n{value}\n`, { value });
      return;
    }

    logger[level]`${message}`;
  }

  export function info(message: string, value?: unknown) {
    log_handler("info", message, value);
  }

  export function warn(message: string, value?: unknown) {
    log_handler("warn", message, value);
  }

  export function error(message: string, value?: unknown) {
    log_handler("error", message, value);
  }

  export function debug(message: string, value?: unknown) {
    log_handler("debug", message, value);
  }
}
