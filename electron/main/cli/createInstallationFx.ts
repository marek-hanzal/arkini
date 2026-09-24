import { match, P } from "ts-pattern";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { Effect, Semaphore } from "effect";

import type { InstallationStatus } from "~electron/contract/cli/InstallationStatus";
import { ElectronMainError } from "../ElectronMainError";
import { createManagedFileFx } from "./createManagedFileFx";

const managedCommandPrefix = "#!/bin/sh\n# serakki-cli managed launcher\n";
const quoteShellArgumentFn = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

/** Main-process ownership of the one user-level serakki-cli command link. */
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
				message: `The packaged serakki-cli launcher is unavailable: ${String(cause)}`,
			};
		}

		const inspection = await managedFile.inspectFn();
		return match(inspection)
			.returnType<InstallationStatus>()
			.with(
				{
					type: "conflict",
				},
				(inspection) => ({
					type: "conflict",
					commandPath,
					message: inspection.message,
					replaceable: inspection.replaceable,
				}),
			)
			.with(
				{
					type: "repairable",
				},
				() => ({
					type: "repairable",
					commandPath,
					message:
						"serakki-cli no longer matches this app or its executable permissions changed. Repair the command to use this Serakki installation.",
				}),
			)
			.with(
				{
					type: "installed",
				},
				() => ({
					type: "installed",
					commandPath,
				}),
			)
			.with(
				{
					type: "missing",
				},
				() => ({
					type: "not-installed",
					commandPath,
				}),
			)
			.exhaustive();
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
			return match(await readStatusFn())
				.returnType<InstallationStatus | Promise<InstallationStatus>>()
				.with(
					{
						type: "installed",
					},
					(status) => status,
				)
				.with(
					{
						type: P.union("unavailable", "conflict"),
					},
					(status) => {
						throw new Error(status.message);
					},
				)
				.with(
					{
						type: "repairable",
					},
					async () => {
						await managedFile.repairFn();
						return readStatusFn();
					},
				)
				.with(
					{
						type: "not-installed",
					},
					async () => {
						await managedFile.publishFn(false);
						return readStatusFn();
					},
				)
				.exhaustive();
		}),
	);
	const replaceFx = semaphore.withPermits(1)(
		operationFx("replace the CLI command", async () => {
			return match(await readStatusFn())
				.returnType<InstallationStatus | Promise<InstallationStatus>>()
				.with(
					{
						type: "installed",
					},
					(status) => status,
				)
				.with(
					{
						type: "unavailable",
					},
					{
						type: "conflict",
						replaceable: false,
					},
					(status) => {
						throw new Error(status.message);
					},
				)
				.with(
					{
						type: P.union("conflict", "repairable", "not-installed"),
					},
					async (status) => {
						await managedFile.publishFn(status.type !== "not-installed");
						return readStatusFn();
					},
				)
				.exhaustive();
		}),
	);
	const uninstallFx = semaphore.withPermits(1)(
		operationFx("uninstall the CLI command", async () => {
			return match(await readStatusFn())
				.returnType<InstallationStatus | Promise<InstallationStatus>>()
				.with(
					{
						type: "not-installed",
					},
					(status) => status,
				)
				.with(
					{
						type: P.union("unavailable", "conflict"),
					},
					(status) => {
						throw new Error(status.message);
					},
				)
				.with(
					{
						type: P.union("installed", "repairable"),
					},
					async () => {
						await managedFile.removeFn();
						return readStatusFn();
					},
				)
				.exhaustive();
		}),
	);

	return {
		readStatusFx,
		installFx,
		replaceFx,
		uninstallFx,
	} satisfies Installation;
});
