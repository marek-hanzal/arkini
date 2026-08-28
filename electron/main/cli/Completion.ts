import type { Effect } from "effect";

import type { CompletionStatus } from "../../contract/cli/CompletionStatus";
import type { ElectronMainError } from "../ElectronMainError";

/** Main-process ownership of one user-level shell completion file. */
export interface Completion {
	readonly readStatusFx: Effect.Effect<CompletionStatus, ElectronMainError>;
	readonly installFx: Effect.Effect<CompletionStatus, ElectronMainError>;
	readonly replaceFx: Effect.Effect<CompletionStatus, ElectronMainError>;
	readonly uninstallFx: Effect.Effect<CompletionStatus, ElectronMainError>;
}
