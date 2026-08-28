import { Effect } from "effect";

import type { CompletionStatus } from "../../../electron/contract/cli/CompletionStatus";

/** Removes only the shell-completion file recognized as Arkini-owned. */
export const uninstallCompletionFx = Effect.fn("uninstallCompletionFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CompletionStatus> => window.arkini.cli.completion.uninstall(),
		catch: (cause) => cause,
	}),
);
