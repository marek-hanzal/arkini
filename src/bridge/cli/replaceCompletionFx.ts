import { Effect } from "effect";

import type { CompletionStatus } from "../../../electron/contract/cli/CompletionStatus";

/** Explicitly replaces one conflicting shell-completion file. */
export const replaceCompletionFx = Effect.fn("replaceCompletionFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CompletionStatus> => window.arkini.cli.completion.replace(),
		catch: (cause) => cause,
	}),
);
