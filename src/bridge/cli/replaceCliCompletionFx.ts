import { Effect } from "effect";

import type { CliCompletionStatus } from "../../../electron/contract/cli/CliCompletionStatus";

/** Explicitly replaces one conflicting shell-completion file. */
export const replaceCliCompletionFx = Effect.fn("replaceCliCompletionFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CliCompletionStatus> => window.arkini.cli.completion.replace(),
		catch: (cause) => cause,
	}),
);
