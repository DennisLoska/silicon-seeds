import { DB } from "./db";
import { createTables } from "./tables";

await createTables(DB.db);
