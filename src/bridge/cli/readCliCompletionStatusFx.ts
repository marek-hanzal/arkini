import { Effect } from "effect";

import type { CliCompletionStatus } from "../../../electron/contract/cli/CliCompletionStatus";

export type {
	CliCompletionShell,
	CliCompletionStatus,
} from "../../../electron/contract/cli/CliCompletionStatus";

/** Reads the current shell-completion installation owned by Arkini Settings. */
export const readCliCompletionStatusFx = Effect.fn("readCliCompletionStatusFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CliCompletionStatus> => window.arkini.cli.completion.status(),
		catch: (cause) => cause,
	}),
);
