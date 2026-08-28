import { Effect } from "effect";

import { installCliCompletionFx } from "~/bridge/cli/installCliCompletionFx";
import {
	readCliCompletionStatusFx,
	type CliCompletionStatus,
} from "~/bridge/cli/readCliCompletionStatusFx";
import { replaceCliCompletionFx } from "~/bridge/cli/replaceCliCompletionFx";
import { uninstallCliCompletionFx } from "~/bridge/cli/uninstallCliCompletionFx";
import {
	createSettingsCliCapabilityCommandAtomFx,
	type SettingsCliCapabilityCommand,
	type SettingsCliCapabilityState,
} from "~/ui/settings/createSettingsCliCapabilityCommandAtomFx";

export namespace SettingsCliCompletionCommandAtom {
	export type Command = SettingsCliCapabilityCommand;
	export type State = SettingsCliCapabilityState<CliCompletionStatus>;
}

/** Owns the Settings command sequence for the current shell completion file. */
export const SettingsCliCompletionCommandAtom = Effect.runSync(
	createSettingsCliCapabilityCommandAtomFx({
		readFx: readCliCompletionStatusFx,
		installFx: installCliCompletionFx,
		replaceFx: replaceCliCompletionFx,
		uninstallFx: uninstallCliCompletionFx,
	}),
);
