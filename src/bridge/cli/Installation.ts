import { Effect } from "effect";

import type { InstallationStatus } from "../../../electron/contract/cli/InstallationStatus";

export type { InstallationStatus } from "../../../electron/contract/cli/InstallationStatus";

const invokeInstallationFx = Effect.fn("invokeInstallationFx")(
	(operation: "status" | "install" | "uninstall") =>
		Effect.tryPromise({
			try: (): Promise<InstallationStatus> => window.arkini.cli[operation](),
			catch: (cause) => cause,
		}),
);

export const readInstallationStatusFx = () => invokeInstallationFx("status");
export const installFx = () => invokeInstallationFx("install");
export const uninstallFx = () => invokeInstallationFx("uninstall");
