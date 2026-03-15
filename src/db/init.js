import { Database } from "bun:sqlite";
import { Logger } from "../logger/logger";

// TODO add tables: jobs, events
const db = new Database("silicon-seeds.sqlite", { create: true });

Logger.info("Database initialized successfully");

export default db;
