import type { Kysely, Transaction } from "kysely";
import { kysely } from "./client";
import type { Database } from "./schema";

export type ArkiniDatabase = Kysely<Database>;
export type ArkiniTransaction = Transaction<Database>;

// Single typed database handle for app code. SQLocal wiring stays in client.ts;
// everything else imports this handle instead of creating its own Kysely shape.
export const db: ArkiniDatabase = kysely;
