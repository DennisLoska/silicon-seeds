import db from "./client";
import { createTables } from "./tables";

await createTables(db);
