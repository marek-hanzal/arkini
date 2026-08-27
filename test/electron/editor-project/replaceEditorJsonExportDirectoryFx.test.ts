import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect, type FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createEditorJsonExportTestHarness,
	type EditorJsonExportTestHarness,
	filesystemFailure,
	readNodeFileSystem,
	readReimportableProject,
	writeReimportableProject,
} from "./replaceEditorJsonExportDirectoryFx.test/harness";

const electron = vi.hoisted(() => ({
	paths: {
		app: "",
		home: "",
		userData: "",
	},
}));

vi.mock("electron", () => ({
	app: {
		getAppPath: () => electron.paths.app,
		getPath: (name: "home" | "userData") => electron.paths[name],
	},
}));

let harness: EditorJsonExportTestHarness;

beforeEach(async () => {
	harness = await createEditorJsonExportTestHarness();
	electron.paths.app = join(harness.root, "protected", "app");
	electron.paths.home = join(harness.root, "protected", "home");
	electron.paths.userData = join(harness.root, "protected", "user-data");
	await Promise.all(
		Object.values(electron.paths).map((path) =>
			mkdir(path, {
				recursive: true,
			}),
		),
	);
});

afterEach(async () => harness.close());

describe("replaceEditorJsonExportDirectoryFx", () => {
	it("publishes a directly re-importable export into a new target", async () => {
		await expect(harness.replace()).resolves.toMatchObject({
			revision: 2,
		});
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(2);
	});

	it("replaces one valid export with the complete staged project", async () => {
		await writeReimportableProject(harness.target, 1);

		await expect(harness.replace()).resolves.toMatchObject({
			revision: 2,
		});
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(2);
	});

	it("keeps the valid target when the source copy fails", async () => {
		await writeReimportableProject(harness.target, 1);
		const fileSystem = await readNodeFileSystem();
		const failing: FileSystem.FileSystem = {
			...fileSystem,
			copy: (from, to, options) =>
				String(from) === harness.source && String(to).endsWith(".pending")
					? Effect.fail(filesystemFailure("copy"))
					: fileSystem.copy(from, to, options),
		};

		await expect(harness.replace(failing)).rejects.toBeDefined();
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(1);
	});

	it("keeps the valid target when staged verification fails", async () => {
		await writeReimportableProject(harness.target, 1);
		const fileSystem = await readNodeFileSystem();
		const failing: FileSystem.FileSystem = {
			...fileSystem,
			readFileString: (path, options) =>
				String(path).includes(".pending/game.json")
					? Effect.fail(filesystemFailure("readFileString"))
					: fileSystem.readFileString(path, options),
		};

		await expect(harness.replace(failing)).rejects.toBeDefined();
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(1);
	});

	it("preserves the staged export when new-target publication cannot be retried", async () => {
		const fileSystem = await readNodeFileSystem();
		let publishAttempts = 0;
		const failing: FileSystem.FileSystem = {
			...fileSystem,
			rename: (from, to) => {
				if (String(from).endsWith(".pending") && String(to) === harness.target) {
					publishAttempts += 1;
					return Effect.fail(filesystemFailure("rename"));
				}
				return fileSystem.rename(from, to);
			},
		};

		let failure: unknown;
		try {
			await harness.replace(failing);
		} catch (cause) {
			failure = cause;
		}
		const pendingName = (await readdir(harness.root)).find((entry) =>
			entry.endsWith(".pending"),
		);
		if (pendingName === undefined) throw new Error("Staged export was not preserved.");
		const pending = join(harness.root, pendingName);
		expect(publishAttempts).toBe(3);
		expect(failure).toMatchObject({
			message: expect.stringContaining(pending),
		});
		expect((await readReimportableProject(pending)).marker.revision).toBe(2);
	});

	it("finishes a new export when the publishing marker write fails", async () => {
		const fileSystem = await readNodeFileSystem();
		const failing: FileSystem.FileSystem = {
			...fileSystem,
			writeFileString: (path, content, options) =>
				String(path).endsWith("/publishing")
					? Effect.fail(filesystemFailure("writeFileString"))
					: fileSystem.writeFileString(path, content, options),
		};

		await expect(harness.replace(failing)).rejects.toThrow(harness.target);
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(2);
	});

	it("reports success when committed-export cleanup fails", async () => {
		await writeReimportableProject(harness.target, 1);
		const fileSystem = await readNodeFileSystem();
		const marker = join(harness.target, ".arkini-export-transaction");
		const failing: FileSystem.FileSystem = {
			...fileSystem,
			remove: (path, options) =>
				String(path) === marker
					? Effect.fail(filesystemFailure("remove"))
					: fileSystem.remove(path, options),
		};

		await expect(harness.replace(failing)).resolves.toMatchObject({
			revision: 2,
		});
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(2);
		await expect(readFile(marker, "utf8")).resolves.toBeDefined();
		expect((await readdir(harness.root)).some((entry) => entry.endsWith(".previous"))).toBe(
			true,
		);
	});
});
