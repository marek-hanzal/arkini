export type CriticalGameLifecycleOperation =
	| "engine-ownership"
	| "game-read"
	| "game-leave"
	| "game-reset"
	| "hmr-handoff";

const causeMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

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
			`Critical Game Engine lifecycle failure during ${operation}: ${causeMessage(cause)}`,
			{
				cause,
			},
		);
		this.name = "CriticalGameLifecycleError";
		this.operation = operation;
	}
}

/** Preserves the first fatal lifecycle error instead of wrapping it repeatedly. */
export const toCriticalGameLifecycleError = ({
	operation,
	cause,
}: {
	readonly operation: CriticalGameLifecycleOperation;
	readonly cause: unknown;
}): CriticalGameLifecycleError =>
	cause instanceof CriticalGameLifecycleError
		? cause
		: new CriticalGameLifecycleError({
				operation,
				cause,
			});
