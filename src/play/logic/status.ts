import { readStatusFx, type DatabaseStatus } from "./fx/readStatusFx";
import { runFx } from "./fx/runFx";

export type { DatabaseStatus };

export function readDatabaseStatus(): Promise<DatabaseStatus> {
	return runFx(readStatusFx());
}
