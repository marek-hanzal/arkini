import { Effect } from "effect";

import type { CliInstallationStatus } from "../../../electron/contract/cli/CliInstallationStatus";

/** Explicitly replaces one conflicting user-level arkini-cli command path. */
export const replaceCliFx = Effect.fn("replaceCliFx")(() =>
	Effect.tryPromise({
		try: (): Promise<CliInstallationStatus> => window.arkini.cli.replace(),
		catch: (cause) => cause,
	}),
);
