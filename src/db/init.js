import { Database } from "bun:sqlite";

// TODO add tables: jobs, events
const db = new Database("silicon-seeds.sqlite", { create: true });

console.log("Database initialized successfully");

export default db;
