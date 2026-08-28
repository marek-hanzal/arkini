import { Effect } from "effect";

import type { CliInstallationStatus } from "../../../electron/contract/cli/CliInstallationStatus";

export type { CliInstallationStatus } from "../../../electron/contract/cli/CliInstallationStatus";

const invokeCliInstallationFx = Effect.fn("invokeCliInstallationFx")(
	(operation: "status" | "install" | "uninstall") =>
		Effect.tryPromise({
			try: (): Promise<CliInstallationStatus> => window.arkini.cli[operation](),
			catch: (cause) => cause,
		}),
);

export const readCliInstallationStatusFx = () => invokeCliInstallationFx("status");
export const installCliFx = () => invokeCliInstallationFx("install");
export const uninstallCliFx = () => invokeCliInstallationFx("uninstall");
