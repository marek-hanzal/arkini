import { Effect } from "effect";

import { createSettingsDirectoryCommandAtomFx } from "~/application-settings/fx/createSettingsDirectoryCommandAtomFx";

/** Owns one user-data-directory request and its interruption-safe settlement. */
export const SettingsUserDataCommandAtom = Effect.runSync(
	createSettingsDirectoryCommandAtomFx(
		Effect.tryPromise({
			try: () => window.arkini.userData.openDirectoryFn(),
			catch: (cause) => cause,
		}),
	),
);
