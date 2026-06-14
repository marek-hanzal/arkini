import { Effect } from "effect";
import { readMigrationStateFx } from "../fx/readMigrationStateFx";

export const readMigrationState = () => Effect.runSync(readMigrationStateFx());
