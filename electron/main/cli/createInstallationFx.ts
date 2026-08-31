import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { Effect, Semaphore } from "effect";

import type { InstallationStatus } from "~electron/contract/cli/InstallationStatus";
import { ElectronMainError } from "../ElectronMainError";
import { createManagedFileFx } from "./createManagedFileFx";

const managedCommandPrefix = "#!/bin/sh\n# arkini-cli managed launcher\n";
const quoteShellArgumentFn = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

/** Main-process ownership of the one user-level arkini-cli command link. */
export interface Installation {
	readonly readStatusFx: Effect.Effect<InstallationStatus, ElectronMainError, never>;
	readonly installFx: Effect.Effect<InstallationStatus, ElectronMainError, never>;
	readonly replaceFx: Effect.Effect<InstallationStatus, ElectronMainError, never>;
	readonly uninstallFx: Effect.Effect<InstallationStatus, ElectronMainError, never>;
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
	const commandContents = `${managedCommandPrefix}exec ${quoteShellArgumentFn(resolvedLauncherPath)} "$@"\n`;
	const managedFile = yield* createManagedFileFx({
		path: commandPath,
		managedPrefix: managedCommandPrefix,
		mode: 0o755,
		subject: "The CLI command",
		readExpectedContentsFn: () => Promise.resolve(commandContents),
		executable: true,
	});

	const readStatusFn = async (): Promise<InstallationStatus> => {
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

		const inspection = await managedFile.inspectFn();
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

	const operationFx = (name: string, runFn: () => Promise<InstallationStatus>) =>
		Effect.tryPromise({
			try: runFn,
			catch: (cause) =>
				new ElectronMainError({
					operation: name,
					cause,
				}),
		});

	const readStatusFx = operationFx("read the CLI installation", readStatusFn);
	const installFx = semaphore.withPermits(1)(
		operationFx("install the CLI command", async () => {
			const status = await readStatusFn();
			if (status.type === "installed") return status;
			if (status.type !== "not-installed" && status.type !== "repairable") {
				throw new Error(status.message);
			}
			if (status.type === "repairable") {
				await managedFile.repairFn();
			} else {
				await managedFile.publishFn(false);
			}
			return readStatusFn();
		}),
	);
	const replaceFx = semaphore.withPermits(1)(
		operationFx("replace the CLI command", async () => {
			const status = await readStatusFn();
			if (status.type === "installed") return status;
			if (status.type === "unavailable") throw new Error(status.message);
			if (status.type === "conflict" && !status.replaceable) {
				throw new Error(status.message);
			}
			await managedFile.publishFn(status.type !== "not-installed");
			return readStatusFn();
		}),
	);
	const uninstallFx = semaphore.withPermits(1)(
		operationFx("uninstall the CLI command", async () => {
			const status = await readStatusFn();
			if (status.type === "not-installed") return status;
			if (status.type !== "installed" && status.type !== "repairable") {
				throw new Error(status.message);
			}
			await managedFile.removeFn();
			return readStatusFn();
		}),
	);

	return {
		readStatusFx,
		installFx,
		replaceFx,
		uninstallFx,
	} satisfies Installation;
});
