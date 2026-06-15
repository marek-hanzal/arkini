import { readStatusFx } from "../fx/readStatusFx";
import type { DatabaseStatus } from "./DatabaseStatus";
import { runEffect } from "./runEffect";

export function readDatabaseStatus(): Promise<DatabaseStatus> {
	return runEffect(readStatusFx());
}
