import { Effect } from "effect";

import type { CompletionStatus } from "../../../electron/contract/cli/CompletionStatus";

/** Installs or repairs the current shell's managed completion file. */
export const installCompletionFx = Effect.fn("installCompletionFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CompletionStatus> => window.arkini.cli.completion.install(),
		catch: (cause) => cause,
	}),
);
