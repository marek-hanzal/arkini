import type { Effect } from "effect";

export type ItemDetailPendingAction =
	| "autofill"
	| "autonomous"
	| "clear-queue"
	| "default"
	| "start"
	| "withdraw";

export interface RunItemDetailPendingActionProps<Result = unknown, Failure = unknown> {
	readonly key: string;
	readonly action: ItemDetailPendingAction;
	readonly failureMessage: string;
	readonly run: Effect.Effect<Result, Failure>;
}

/** Narrow command-settlement capability shared by Item Detail command atoms. */
export interface ItemDetailPendingActionOwner {
	readonly readActionError: (key: string) => string | null;
	readonly readPendingAction: (key: string) => ItemDetailPendingAction | null;
	readonly runPendingAction: <Result, Failure>(
		props: RunItemDetailPendingActionProps<Result, Failure>,
	) => void;
}
