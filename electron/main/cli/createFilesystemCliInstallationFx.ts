import { constants } from "node:fs";
import { access, chmod, lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Effect, Semaphore } from "effect";

import type { CliInstallationStatus } from "../../contract/cli/CliInstallationStatus";
import { ElectronMainError } from "../ElectronMainError";
import type { CliInstallation } from "./CliInstallation";

const isMissing = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";
const managedCommandMarker = "# arkini-cli managed launcher v1";
const quoteShellArgument = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

type CommandInspection =
	| {
			readonly type: "missing" | "installed" | "repairable";
	  }
	| {
			readonly type: "conflict";
			readonly message: string;
	  };

export namespace createFilesystemCliInstallationFx {
	export interface Props {
		readonly commandPath: string;
		readonly launcherPath: string;
		readonly unavailableMessage?: string;
	}
}

/** Creates the owned command shim used by Settings; foreign paths are never replaced. */
export const createFilesystemCliInstallationFx = Effect.fn("createFilesystemCliInstallationFx")(
	function* ({
		commandPath,
		launcherPath,
		unavailableMessage,
	}: createFilesystemCliInstallationFx.Props) {
		const semaphore = yield* Semaphore.make(1);
		const resolvedLauncherPath = resolve(launcherPath);
		const commandContents = `#!/bin/sh\n${managedCommandMarker}\nexec ${quoteShellArgument(resolvedLauncherPath)} "$@"\n`;
		const inspectCommand = async (): Promise<CommandInspection> => {
			let command;
			try {
				command = await lstat(commandPath);
			} catch (cause) {
				if (isMissing(cause))
					return {
						type: "missing",
					};
				throw cause;
			}
			if (!command.isFile()) {
				return {
					type: "conflict",
					message: `Another file already exists at ${commandPath}.`,
				};
			}
			const existingContents = await readFile(commandPath, "utf8");
			if (existingContents === commandContents) {
				try {
					await access(commandPath, constants.X_OK);
					return {
						type: "installed",
					};
				} catch {
					return {
						type: "repairable",
					};
				}
			}
			if (existingContents.startsWith(`#!/bin/sh\n${managedCommandMarker}\n`)) {
				return {
					type: "repairable",
				};
			}
			return {
				type: "conflict",
				message: `Another file already exists at ${commandPath}.`,
			};
		};
		const readStatus = async (): Promise<CliInstallationStatus> => {
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

			const inspection = await inspectCommand();
			if (inspection.type === "conflict") {
				return {
					type: "conflict",
					commandPath,
					message: inspection.message,
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
		const operation = (name: string, run: () => Promise<CliInstallationStatus>) =>
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
				await mkdir(dirname(commandPath), {
					recursive: true,
				});
				if (status.type === "repairable") await unlink(commandPath);
				await writeFile(commandPath, commandContents, {
					encoding: "utf8",
					flag: "wx",
					mode: 0o755,
				});
				await chmod(commandPath, 0o755);
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
				await unlink(commandPath);
				return readStatus();
			}),
		);

		return {
			readStatusFx,
			installFx,
			uninstallFx,
		} satisfies CliInstallation;
	},
);
