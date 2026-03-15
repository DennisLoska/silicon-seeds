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

  function log_handler(message: string, value?: unknown) {
    if (value) {
      logger.info(`${message}\n\n{value}\n`, { value });
    } else {
      logger.info`${message}`;
    }
  }
  export function info(message: string, value?: unknown) {
    log_handler(message, value);
  }

  export function warn(message: string, value?: unknown) {
    log_handler(message, value);
  }

  export function error(message: string, value?: unknown) {
    log_handler(message, value);
  }

  export function debug(message: string, value?: unknown) {
    log_handler(message, value);
  }
}
