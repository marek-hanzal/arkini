import { Effect } from "effect";
import { bootstrapFx } from "../fx/bootstrapFx";
import { hardResetFx } from "../fx/hardResetFx";
import { readDatabasePathFx } from "../fx/readDatabasePathFx";
import { readGameConfigHashFx } from "../fx/readGameConfigHashFx";
import { readMigrationStateFx } from "../fx/readMigrationStateFx";
import { runEffect } from "./runEffect";

export function bootstrapDatabase() {
	return runEffect(bootstrapFx());
}

export function readMigrationState() {
	return Effect.runSync(readMigrationStateFx());
}

export function readDatabasePath() {
	return runEffect(readDatabasePathFx());
}

export function readGameConfigHash() {
	return Effect.runSync(readGameConfigHashFx());
}

export function hardResetDatabaseFile() {
	return runEffect(hardResetFx());
}
