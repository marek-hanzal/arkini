import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createInstallationFx } from "~electron/main/cli/createInstallationFx";

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);

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
	const directory = await mkdtemp(join(tmpdir(), "arkini cli's installation-"));
	temporaryDirectories.push(directory);
	const launcherPath = join(directory, "Arkini.app", "Contents", "MacOS", "arkini-cli");
	const commandPath = join(directory, "home", ".local", "bin", "arkini-cli");
	await mkdir(dirname(launcherPath), {
		recursive: true,
	});
	await writeFile(launcherPath, "#!/bin/sh\nprintf '%s\\n' \"$@\"\n");
	await chmod(launcherPath, 0o755);
	const installation = Effect.runSync(
		createInstallationFx({
			commandPath,
			launcherPath,
		}),
	);
	return {
		commandPath,
		installation,
		launcherPath,
	};
};

describe.skipIf(process.platform === "win32")("filesystem CLI installation", () => {
	it("installs and removes its managed command shim", async () => {
		const fixture = await createFixture();
		await expect(Effect.runPromise(fixture.installation.readStatusFx)).resolves.toMatchObject({
			type: "not-installed",
		});
		await expect(Effect.runPromise(fixture.installation.installFx)).resolves.toMatchObject({
			type: "installed",
		});
		expect(await readFile(fixture.commandPath, "utf8")).toContain(
			"# arkini-cli managed launcher",
		);
		await expect(
			execFileAsync(fixture.commandPath, [
				"game",
				"validate",
			]),
		).resolves.toMatchObject({
			stdout: "game\nvalidate\n",
		});

		await expect(Effect.runPromise(fixture.installation.uninstallFx)).resolves.toMatchObject({
			type: "not-installed",
		});
	});

	it("repairs its command after the packaged app moves", async () => {
		const fixture = await createFixture();
		await mkdir(dirname(fixture.commandPath), {
			recursive: true,
		});
		await writeFile(
			fixture.commandPath,
			"#!/bin/sh\n# arkini-cli managed launcher\nexec '/Volumes/Arkini/Arkini.app/Contents/MacOS/arkini-cli' \"$@\"\n",
		);

		await expect(Effect.runPromise(fixture.installation.readStatusFx)).resolves.toMatchObject({
			type: "repairable",
		});
		await expect(Effect.runPromise(fixture.installation.installFx)).resolves.toMatchObject({
			type: "installed",
		});
		await expect(
			execFileAsync(fixture.commandPath, [
				"--version",
			]),
		).resolves.toMatchObject({
			stdout: "--version\n",
		});
	});

	it("repairs its command when the executable bit is lost", async () => {
		const fixture = await createFixture();
		await Effect.runPromise(fixture.installation.installFx);
		await chmod(fixture.commandPath, 0o644);

		await expect(Effect.runPromise(fixture.installation.readStatusFx)).resolves.toMatchObject({
			type: "repairable",
		});
		await expect(Effect.runPromise(fixture.installation.installFx)).resolves.toMatchObject({
			type: "installed",
		});
		await expect(
			execFileAsync(fixture.commandPath, [
				"--version",
			]),
		).resolves.toMatchObject({
			stdout: "--version\n",
		});
	});

	it("requires an explicit replace before atomically taking over a foreign command", async () => {
		const fixture = await createFixture();
		await mkdir(dirname(fixture.commandPath), {
			recursive: true,
		});
		await writeFile(fixture.commandPath, "foreign\n");

		await expect(Effect.runPromise(fixture.installation.readStatusFx)).resolves.toMatchObject({
			type: "conflict",
			replaceable: true,
		});
		await expect(Effect.runPromise(fixture.installation.installFx)).rejects.toThrow(
			"install the CLI command",
		);
		expect(await readFile(fixture.commandPath, "utf8")).toBe("foreign\n");

		await expect(Effect.runPromise(fixture.installation.replaceFx)).resolves.toMatchObject({
			type: "installed",
		});
		expect(await readFile(fixture.commandPath, "utf8")).toContain(
			"# arkini-cli managed launcher",
		);
	});

	it("refuses to replace a conflicting directory", async () => {
		const fixture = await createFixture();
		await mkdir(fixture.commandPath, {
			recursive: true,
		});

		await expect(Effect.runPromise(fixture.installation.readStatusFx)).resolves.toMatchObject({
			type: "conflict",
			replaceable: false,
		});
		await expect(Effect.runPromise(fixture.installation.replaceFx)).rejects.toThrow(
			"replace the CLI command",
		);
	});
});
