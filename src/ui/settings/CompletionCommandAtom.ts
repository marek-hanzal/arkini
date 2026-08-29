import { Effect } from "effect";

import type { CompletionStatus } from "../../../electron/contract/cli/CompletionStatus";
import {
	createCliCommandAtomFx,
	type CliCommand,
	type CliState,
} from "~/ui/settings/createCliCommandAtomFx";

export namespace CompletionCommandAtom {
	export type Command = CliCommand;
	export type State = CliState<CompletionStatus>;
}

/** Owns the Settings command sequence for the current shell completion file. */
export const CompletionCommandAtom = Effect.runSync(
	createCliCommandAtomFx({
		readFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.arkini.cli.completion.status(),
				catch: (cause) => cause,
			}),
		installFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.arkini.cli.completion.install(),
				catch: (cause) => cause,
			}),
		replaceFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.arkini.cli.completion.replace(),
				catch: (cause) => cause,
			}),
		uninstallFx: () =>
			Effect.tryPromise({
				try: (): Promise<CompletionStatus> => window.arkini.cli.completion.uninstall(),
				catch: (cause) => cause,
			}),
	}),
);
