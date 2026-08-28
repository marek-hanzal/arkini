import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const renameInterception = vi.hoisted(() => ({
	before: undefined as
		| undefined
		| ((
				from: string,
				to: string,
				rename: (from: string, to: string) => Promise<void>,
		  ) => Promise<void>),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		rename: async (
			from: Parameters<typeof actual.rename>[0],
			to: Parameters<typeof actual.rename>[1],
		) => {
			if (
				typeof from === "string" &&
				typeof to === "string" &&
				renameInterception.before !== undefined
			) {
				await renameInterception.before(from, to, (source, target) =>
					actual.rename(source, target),
				);
			}
			return actual.rename(from, to);
		},
	};
});

import { createFilesystemCliCompletionFx } from "../../electron/main/cli/createFilesystemCliCompletionFx";
import { createFilesystemCliInstallationFx } from "../../electron/main/cli/createFilesystemCliInstallationFx";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	renameInterception.before = undefined;
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, {
				recursive: true,
				force: true,
			}),
		),
	);
});

const createLauncher = async (directory: string) => {
	const launcherPath = join(directory, "Arkini.app", "Contents", "MacOS", "arkini-cli");
	await mkdir(dirname(launcherPath), {
		recursive: true,
	});
	await writeFile(launcherPath, "#!/bin/sh\nprintf '# generated %s completion\\n' \"$2\"\n");
	await chmod(launcherPath, 0o755);
	return launcherPath;
};

const expectForeignClaimPreserved = async (path: string) => {
	const entries = await readdir(dirname(path), {
		withFileTypes: true,
	});
	const claimDirectory = entries.find(
		(entry) => entry.isDirectory() && entry.name.startsWith(".arkini-cli-removal-"),
	);
	if (claimDirectory === undefined) throw new Error("Expected a preserved removal claim.");
	await expect(
		readFile(join(dirname(path), claimDirectory.name, basename(path)), "utf8"),
	).resolves.toBe("foreign\n");
};

const replacePathBeforeClaim = (path: string, displacedPath: string) => {
	renameInterception.before = async (from, to, rename) => {
		if (from !== path || !dirname(to).includes(".arkini-cli-removal-")) return;
		renameInterception.before = undefined;
		await rename(path, displacedPath);
		await writeFile(path, "foreign\n");
	};
};

describe.skipIf(process.platform === "win32")("CLI removal claims", () => {
	it("preserves a command file swapped in before the removal claim", async () => {
		const directory = await mkdtemp(join(tmpdir(), "arkini CLI removal claim-"));
		temporaryDirectories.push(directory);
		const launcherPath = await createLauncher(directory);
		const commandPath = join(directory, "home", ".local", "bin", "arkini-cli");
		const installation = Effect.runSync(
			createFilesystemCliInstallationFx({
				commandPath,
				launcherPath,
			}),
		);
		await Effect.runPromise(installation.installFx);
		replacePathBeforeClaim(commandPath, join(directory, "managed-command"));

		await expect(Effect.runPromise(installation.uninstallFx)).rejects.toThrow(
			"uninstall the CLI command",
		);
		await expectForeignClaimPreserved(commandPath);
	});

	it("preserves a completion file swapped in before the removal claim", async () => {
		const directory = await mkdtemp(join(tmpdir(), "arkini completion removal claim-"));
		temporaryDirectories.push(directory);
		const launcherPath = await createLauncher(directory);
		const completionPath = join(directory, "home", ".zsh", "completions", "_arkini-cli");
		const completion = Effect.runSync(
			createFilesystemCliCompletionFx({
				completion: {
					path: completionPath,
					shell: "zsh",
				},
				launcherPath,
			}),
		);
		await Effect.runPromise(completion.installFx);
		replacePathBeforeClaim(completionPath, join(directory, "managed-completion"));

		await expect(Effect.runPromise(completion.uninstallFx)).rejects.toThrow(
			"uninstall CLI shell completion",
		);
		await expectForeignClaimPreserved(completionPath);
	});
});
