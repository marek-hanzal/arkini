export type GameSessionFatalSource =
	| "autosave"
	| "presentation"
	| "runtime"
	| "subscription"
	| "tick"
	| "ui";

/** The first unrecoverable background failure of one exact GameSession. */
export class GameSessionFatalError extends Error {
	readonly source: GameSessionFatalSource;

	constructor({
		source,
		cause,
	}: {
		readonly source: GameSessionFatalSource;
		readonly cause: unknown;
	}) {
		super(
			`Game session failed during ${source}: ${
				cause instanceof Error ? cause.message : String(cause)
			}`,
			{
				cause,
			},
		);
		this.name = "GameSessionFatalError";
		this.source = source;
	}
}
