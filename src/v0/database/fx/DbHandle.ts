import type { ArkiniDatabase, ArkiniTransaction } from "~/database/local/db";

export type DbHandle = ArkiniDatabase | ArkiniTransaction;
