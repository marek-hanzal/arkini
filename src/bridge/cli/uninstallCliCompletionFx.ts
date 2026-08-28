import { Effect } from "effect";

import type { CliCompletionStatus } from "../../../electron/contract/cli/CliCompletionStatus";

/** Removes only the shell-completion file recognized as Arkini-owned. */
export const uninstallCliCompletionFx = Effect.fn("uninstallCliCompletionFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CliCompletionStatus> => window.arkini.cli.completion.uninstall(),
		catch: (cause) => cause,
	}),
);
