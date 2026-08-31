import { Effect } from "effect";

import type { InstallationStatus } from "~electron/contract/cli/InstallationStatus";
import { createCliCommandAtomFx } from "~/application-settings/fx/createCliCommandAtomFx";

/** Owns the Settings command sequence for the packaged CLI launcher. */
export const CliCommandAtom = Effect.runSync(
	createCliCommandAtomFx({
		readFx: () =>
			Effect.tryPromise({
				try: (): Promise<InstallationStatus> => window.arkini.cli.statusFn(),
				catch: (cause) => cause,
			}),
		installFx: () =>
			Effect.tryPromise({
				try: (): Promise<InstallationStatus> => window.arkini.cli.installFn(),
				catch: (cause) => cause,
			}),
		replaceFx: () =>
			Effect.tryPromise({
				try: (): Promise<InstallationStatus> => window.arkini.cli.replaceFn(),
				catch: (cause) => cause,
			}),
		uninstallFx: () =>
			Effect.tryPromise({
				try: (): Promise<InstallationStatus> => window.arkini.cli.uninstallFn(),
				catch: (cause) => cause,
			}),
	}),
);
