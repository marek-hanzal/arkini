import { Data } from "effect";
import type { GameSaveStorage } from "~/engine/save/GameSaveStorage";

/** Marks a verified package bootstrap failure caused by its exact durable save. */
export class GameSaveBootstrapError extends Data.TaggedError("GameSaveBootstrapError")<{
	readonly cause: unknown;
	readonly saveKey: GameSaveStorage.Key;
}> {}
