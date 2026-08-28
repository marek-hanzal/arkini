import { Effect } from "effect";

import { installCompletionFx } from "~/bridge/cli/installCompletionFx";
import { readCompletionStatusFx, type CompletionStatus } from "~/bridge/cli/readCompletionStatusFx";
import { replaceCompletionFx } from "~/bridge/cli/replaceCompletionFx";
import { uninstallCompletionFx } from "~/bridge/cli/uninstallCompletionFx";
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
		readFx: readCompletionStatusFx,
		installFx: installCompletionFx,
		replaceFx: replaceCompletionFx,
		uninstallFx: uninstallCompletionFx,
	}),
);
