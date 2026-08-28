import { Data } from "effect";

/** A command targeted a Game session that no longer accepts new work. */
export class GameSessionNotRunningError extends Data.TaggedError("GameSessionNotRunningError")<{
	readonly message: string;
	readonly state: "disposing" | "frozen" | "disposed";
}> {}
