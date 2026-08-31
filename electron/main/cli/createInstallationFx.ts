import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { Effect, Semaphore } from "effect";

import type { InstallationStatus } from "~electron/contract/cli/InstallationStatus";
import { ElectronMainError } from "../ElectronMainError";
import { createManagedFileFx } from "./createManagedFileFx";

const managedCommandPrefix = "#!/bin/sh\n# arkini-cli managed launcher\n";
const quoteShellArgument = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

/** Main-process ownership of the one user-level arkini-cli command link. */
export interface Installation {
	readonly readStatusFx: Effect.Effect<InstallationStatus, ElectronMainError>;
	readonly installFx: Effect.Effect<InstallationStatus, ElectronMainError>;
	readonly replaceFx: Effect.Effect<InstallationStatus, ElectronMainError>;
	readonly uninstallFx: Effect.Effect<InstallationStatus, ElectronMainError>;
}

export namespace createInstallationFx {
	export interface Props {
		readonly commandPath: string;
		readonly launcherPath: string;
		readonly unavailableMessage?: string;
	}
}

/** Creates the owned command shim used by Settings; foreign file takeover stays explicit. */
export const createInstallationFx = Effect.fn("createInstallationFx")(function* ({
	commandPath,
	launcherPath,
	unavailableMessage,
}: createInstallationFx.Props) {
	const semaphore = yield* Semaphore.make(1);
	const resolvedLauncherPath = resolve(launcherPath);
	const commandContents = `${managedCommandPrefix}exec ${quoteShellArgument(resolvedLauncherPath)} "$@"\n`;
	const managedFile = yield* createManagedFileFx({
		path: commandPath,
		managedPrefix: managedCommandPrefix,
		mode: 0o755,
		subject: "The CLI command",
		readExpectedContents: () => Promise.resolve(commandContents),
		executable: true,
	});

	const readStatus = async (): Promise<InstallationStatus> => {
		if (unavailableMessage !== undefined) {
			return {
				type: "unavailable",
				commandPath,
				message: unavailableMessage,
			};
		}
		try {
			await access(resolvedLauncherPath, constants.X_OK);
		} catch (cause) {
			return {
				type: "unavailable",
				commandPath,
				message: `The packaged arkini-cli launcher is unavailable: ${String(cause)}`,
			};
		}

		const inspection = await managedFile.inspect();
		if (inspection.type === "conflict") {
			return {
				type: "conflict",
				commandPath,
				message: inspection.message,
				replaceable: inspection.replaceable,
			};
		}
		if (inspection.type === "repairable") {
			return {
				type: "repairable",
				commandPath,
				message:
					"arkini-cli no longer matches this app or its executable permissions changed. Repair the command to use this Arkini installation.",
			};
		}
		return {
			type: inspection.type === "installed" ? "installed" : "not-installed",
			commandPath,
		};
	};

	const operation = (name: string, run: () => Promise<InstallationStatus>) =>
		Effect.tryPromise({
			try: run,
			catch: (cause) =>
				new ElectronMainError({
					operation: name,
					cause,
				}),
		});

	const readStatusFx = operation("read the CLI installation", readStatus);
	const installFx = semaphore.withPermits(1)(
		operation("install the CLI command", async () => {
			const status = await readStatus();
			if (status.type === "installed") return status;
			if (status.type !== "not-installed" && status.type !== "repairable") {
				throw new Error(status.message);
			}
			if (status.type === "repairable") {
				await managedFile.repair();
			} else {
				await managedFile.publish(false);
			}
			return readStatus();
		}),
	);
	const replaceFx = semaphore.withPermits(1)(
		operation("replace the CLI command", async () => {
			const status = await readStatus();
			if (status.type === "installed") return status;
			if (status.type === "unavailable") throw new Error(status.message);
			if (status.type === "conflict" && !status.replaceable) {
				throw new Error(status.message);
			}
			await managedFile.publish(status.type !== "not-installed");
			return readStatus();
		}),
	);
	const uninstallFx = semaphore.withPermits(1)(
		operation("uninstall the CLI command", async () => {
			const status = await readStatus();
			if (status.type === "not-installed") return status;
			if (status.type !== "installed" && status.type !== "repairable") {
				throw new Error(status.message);
			}
			await managedFile.remove();
			return readStatus();
		}),
	);

	return {
		readStatusFx,
		installFx,
		replaceFx,
		uninstallFx,
	} satisfies Installation;
});
