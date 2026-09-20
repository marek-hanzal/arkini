import { Effect } from "effect";

import type { CompletionStatus } from "~electron/contract/cli/CompletionStatus";
import { createCliCommandAtomFx } from "~/application-settings/fx/createCliCommandAtomFx";

/** Owns the Settings command sequence for the current shell completion file. */
export const CompletionCommandAtom = Effect.runSync(
	createCliCommandAtomFx({
		readFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.serakki.cli.completion.statusFn(),
				catch: (cause) => cause,
			}),
		installFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.serakki.cli.completion.installFn(),
				catch: (cause) => cause,
			}),
		replaceFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.serakki.cli.completion.replaceFn(),
				catch: (cause) => cause,
			}),
		uninstallFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.serakki.cli.completion.uninstallFn(),
				catch: (cause) => cause,
			}),
	}),
);
