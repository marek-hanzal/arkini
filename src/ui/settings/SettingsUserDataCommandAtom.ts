import { Effect } from "effect";

import { createSettingsDirectoryCommandAtomFx } from "~/ui/settings/createSettingsDirectoryCommandAtomFx";

/** Owns one user-data-directory request and its interruption-safe settlement. */
export const SettingsUserDataCommandAtom = Effect.runSync(
	createSettingsDirectoryCommandAtomFx(
		Effect.tryPromise({
			try: () => window.arkini.userData.openDirectory(),
			catch: (cause) => cause,
		}),
	),
);
