import { Effect } from "effect";

import { openDiagnosticDirectoryFx } from "~/application-diagnostics/fx/openDiagnosticDirectoryFx";
import { createSettingsDirectoryCommandAtomFx } from "~/ui/settings/createSettingsDirectoryCommandAtomFx";

/** Owns one diagnostics-directory request and its interruption-safe settlement. */
export const SettingsDiagnosticsCommandAtom = Effect.runSync(
	createSettingsDirectoryCommandAtomFx(openDiagnosticDirectoryFx()),
);
