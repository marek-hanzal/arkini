import { Effect } from "effect";

import { openDiagnosticDirectoryFx } from "~/renderer/diagnostics/openDiagnosticDirectoryFx";
import {
	createSettingsDirectoryCommandAtomFx,
	type SettingsDirectoryCommandState,
} from "~/ui/settings/createSettingsDirectoryCommandAtomFx";

export type SettingsDiagnosticsCommandState = SettingsDirectoryCommandState;

/** Owns one diagnostics-directory request and its interruption-safe settlement. */
export const SettingsDiagnosticsCommandAtom = Effect.runSync(
	createSettingsDirectoryCommandAtomFx(openDiagnosticDirectoryFx()),
);
