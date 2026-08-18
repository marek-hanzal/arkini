import { Effect } from "effect";

import { openUserDataDirectoryFx } from "~/bridge/user-data/UserData";
import {
	createSettingsDirectoryCommandAtomFx,
	type SettingsDirectoryCommandState,
} from "~/ui/settings/createSettingsDirectoryCommandAtomFx";

export type SettingsUserDataCommandState = SettingsDirectoryCommandState;

/** Owns one user-data-directory request and its interruption-safe settlement. */
export const SettingsUserDataCommandAtom = Effect.runSync(
	createSettingsDirectoryCommandAtomFx(openUserDataDirectoryFx()),
);
