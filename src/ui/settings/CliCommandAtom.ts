import { Effect } from "effect";

import {
	installFx,
	readInstallationStatusFx,
	type InstallationStatus,
	uninstallFx,
} from "~/bridge/cli/Installation";
import { replaceFx } from "~/bridge/cli/replaceFx";
import {
	createCliCommandAtomFx,
	type CliCommand,
	type CliState,
} from "~/ui/settings/createCliCommandAtomFx";

export namespace CliCommandAtom {
	export type Command = CliCommand;
	export type State = CliState<InstallationStatus>;
}

/** Owns the Settings command sequence for the packaged CLI launcher. */
export const CliCommandAtom = Effect.runSync(
	createCliCommandAtomFx({
		readFx: readInstallationStatusFx,
		installFx: installFx,
		replaceFx: replaceFx,
		uninstallFx: uninstallFx,
	}),
);
