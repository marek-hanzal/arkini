import type { Effect } from "effect";

import type { CliCompletionStatus } from "../../contract/cli/CliCompletionStatus";
import type { ElectronMainError } from "../ElectronMainError";

/** Main-process ownership of one user-level shell completion file. */
export interface CliCompletion {
	readonly readStatusFx: Effect.Effect<CliCompletionStatus, ElectronMainError>;
	readonly installFx: Effect.Effect<CliCompletionStatus, ElectronMainError>;
	readonly replaceFx: Effect.Effect<CliCompletionStatus, ElectronMainError>;
	readonly uninstallFx: Effect.Effect<CliCompletionStatus, ElectronMainError>;
}
