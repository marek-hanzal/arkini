import { Effect } from "effect";

import type { CompletionStatus } from "../../../electron/contract/cli/CompletionStatus";

export type {
	CompletionShell,
	CompletionStatus,
} from "../../../electron/contract/cli/CompletionStatus";

/** Reads the current shell-completion installation owned by Arkini Settings. */
export const readCompletionStatusFx = Effect.fn("readCompletionStatusFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CompletionStatus> => window.arkini.cli.completion.status(),
		catch: (cause) => cause,
	}),
);
