import type { Effect } from "effect";

import type { InstallationStatus } from "../../contract/cli/InstallationStatus";
import type { ElectronMainError } from "../ElectronMainError";

/** Main-process ownership of the one user-level arkini-cli command link. */
export interface Installation {
	readonly readStatusFx: Effect.Effect<InstallationStatus, ElectronMainError>;
	readonly installFx: Effect.Effect<InstallationStatus, ElectronMainError>;
	readonly replaceFx: Effect.Effect<InstallationStatus, ElectronMainError>;
	readonly uninstallFx: Effect.Effect<InstallationStatus, ElectronMainError>;
}
