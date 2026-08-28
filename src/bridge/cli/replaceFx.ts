import { Effect } from "effect";

import type { InstallationStatus } from "../../../electron/contract/cli/InstallationStatus";

/** Explicitly replaces one conflicting user-level arkini-cli command path. */
export const replaceFx = Effect.fn("replaceFx")(() =>
	Effect.tryPromise({
		try: (): Promise<InstallationStatus> => window.arkini.cli.replace(),
		catch: (cause) => cause,
	}),
);
