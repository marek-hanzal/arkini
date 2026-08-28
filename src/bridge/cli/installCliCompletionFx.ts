import { Effect } from "effect";

import type { CliCompletionStatus } from "../../../electron/contract/cli/CliCompletionStatus";

/** Installs or repairs the current shell's managed completion file. */
export const installCliCompletionFx = Effect.fn("installCliCompletionFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CliCompletionStatus> => window.arkini.cli.completion.install(),
		catch: (cause) => cause,
	}),
);
