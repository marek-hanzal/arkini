import { readStatusFx } from "../fx/readStatusFx";
import type { DatabaseStatus } from "./DatabaseStatus";
import { runEffect } from "./runEffect";

/**
 * GPT:FIX
 *
 * Why?
 */
export type { DatabaseStatus };

export function readDatabaseStatus(): Promise<DatabaseStatus> {
	return runEffect(readStatusFx());
}
