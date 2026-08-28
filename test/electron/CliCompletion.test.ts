import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createFilesystemCliCompletionFx } from "../../electron/main/cli/createFilesystemCliCompletionFx";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, {
				recursive: true,
				force: true,
			}),
		),
	);
});

const createFixture = async () => {
	const directory = await mkdtemp(join(tmpdir(), "arkini CLI completion-"));
	temporaryDirectories.push(directory);
	const launcherPath = join(directory, "Arkini.app", "Contents", "MacOS", "arkini-cli");
	const completionPath = join(directory, "home", ".zsh", "completions", "_arkini-cli");
	await mkdir(dirname(launcherPath), {
		recursive: true,
	});
	await writeFile(launcherPath, "#!/bin/sh\nprintf '# generated %s completion\\n' \"$2\"\n");
	await chmod(launcherPath, 0o755);
	const completion = Effect.runSync(
		createFilesystemCliCompletionFx({
			completion: {
				path: completionPath,
				shell: "zsh",
			},
			launcherPath,
		}),
	);
	return {
		completion,
		completionPath,
	};
};

describe.skipIf(process.platform === "win32")("filesystem CLI completion", () => {
	it("installs generated completion and removes only its managed file", async () => {
		const fixture = await createFixture();

		await expect(Effect.runPromise(fixture.completion.installFx)).resolves.toMatchObject({
			type: "installed",
			shell: "zsh",
		});
		expect(await readFile(fixture.completionPath, "utf8")).toBe(
			"# arkini-cli managed completion\n# generated zsh completion\n",
		);
		await expect(Effect.runPromise(fixture.completion.uninstallFx)).resolves.toMatchObject({
			type: "not-installed",
		});
	});

	it("repairs an outdated managed completion", async () => {
		const fixture = await createFixture();
		await mkdir(dirname(fixture.completionPath), {
			recursive: true,
		});
		await writeFile(
			fixture.completionPath,
			"# arkini-cli managed completion\n# stale completion\n",
		);

		await expect(Effect.runPromise(fixture.completion.readStatusFx)).resolves.toMatchObject({
			type: "repairable",
		});
		await expect(Effect.runPromise(fixture.completion.installFx)).resolves.toMatchObject({
			type: "installed",
		});
	});

	it("requires an explicit replace before taking over a foreign completion", async () => {
		const fixture = await createFixture();
		await mkdir(dirname(fixture.completionPath), {
			recursive: true,
		});
		await writeFile(fixture.completionPath, "foreign\n");

		await expect(Effect.runPromise(fixture.completion.readStatusFx)).resolves.toMatchObject({
			type: "conflict",
			replaceable: true,
		});
		await expect(Effect.runPromise(fixture.completion.installFx)).rejects.toThrow(
			"install CLI shell completion",
		);
		expect(await readFile(fixture.completionPath, "utf8")).toBe("foreign\n");
		await expect(Effect.runPromise(fixture.completion.replaceFx)).resolves.toMatchObject({
			type: "installed",
		});
	});
});
