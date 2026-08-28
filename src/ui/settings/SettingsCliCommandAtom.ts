import { Effect } from "effect";

import {
	installCliFx,
	readCliInstallationStatusFx,
	type CliInstallationStatus,
	uninstallCliFx,
} from "~/bridge/cli/CliInstallation";
import { replaceCliFx } from "~/bridge/cli/replaceCliFx";
import {
	createSettingsCliCapabilityCommandAtomFx,
	type SettingsCliCapabilityCommand,
	type SettingsCliCapabilityState,
} from "~/ui/settings/createSettingsCliCapabilityCommandAtomFx";

export namespace SettingsCliCommandAtom {
	export type Command = SettingsCliCapabilityCommand;
	export type State = SettingsCliCapabilityState<CliInstallationStatus>;
}

/** Owns the Settings command sequence for the packaged CLI launcher. */
export const SettingsCliCommandAtom = Effect.runSync(
	createSettingsCliCapabilityCommandAtomFx({
		readFx: readCliInstallationStatusFx,
		installFx: installCliFx,
		replaceFx: replaceCliFx,
		uninstallFx: uninstallCliFx,
	}),
);
