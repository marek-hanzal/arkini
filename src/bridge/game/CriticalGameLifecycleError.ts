export type CriticalGameLifecycleOperation =
	| "engine-ownership"
	| "game-read"
	| "game-leave"
	| "game-reset";

/** Ends the current renderer run after one critical Game Engine ownership failure. */
export class CriticalGameLifecycleError extends Error {
	readonly operation: CriticalGameLifecycleOperation;

	constructor({
		operation,
		cause,
	}: {
		readonly operation: CriticalGameLifecycleOperation;
		readonly cause: unknown;
	}) {
		super(
			`Critical Game Engine lifecycle failure during ${operation}: ${
				cause instanceof Error ? cause.message : String(cause)
			}`,
			{
				cause,
			},
		);
		this.name = "CriticalGameLifecycleError";
		this.operation = operation;
	}
}
