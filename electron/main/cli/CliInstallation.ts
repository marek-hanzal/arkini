import type { Effect } from "effect";

import type { CliInstallationStatus } from "../../contract/cli/CliInstallationStatus";
import type { ElectronMainError } from "../ElectronMainError";

/** Main-process ownership of the one user-level arkini-cli command link. */
export interface CliInstallation {
	readonly readStatusFx: Effect.Effect<CliInstallationStatus, ElectronMainError>;
	readonly installFx: Effect.Effect<CliInstallationStatus, ElectronMainError>;
	readonly uninstallFx: Effect.Effect<CliInstallationStatus, ElectronMainError>;
}
